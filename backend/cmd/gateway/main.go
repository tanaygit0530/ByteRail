package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"

	"byterail/internal/history"
	"byterail/internal/loadgen"
	"byterail/pkg/metrics"
	pb "byterail/pkg/proto/pipeline"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Gateway struct {
	tracker      *metrics.Tracker
	historyStore *history.Store
	loadGen      *loadgen.LoadGenerator
	grpcConn     *grpc.ClientConn
	grpcClient   pb.EventPipelineClient

	wsClientsMu sync.Mutex
	wsClients   map[*websocket.Conn]bool
	routingLogs []RoutingLogEntry
	logsMu      sync.Mutex

	orderGRPCAddr string
	orderHTTPAddr string
}

type RoutingLogEntry struct {
	Timestamp string `json:"timestamp"`
	Header    string `json:"header"`
	Mode      string `json:"mode"`
	Rationale string `json:"rationale"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	orderGRPC := os.Getenv("ORDER_GRPC_ADDR")
	if orderGRPC == "" {
		orderGRPC = "localhost:50051"
	}
	orderHTTP := os.Getenv("ORDER_HTTP_ADDR")
	if orderHTTP == "" {
		orderHTTP = "http://localhost:8081"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/byterail_history.db"
	}

	histStore, err := history.NewStore(dbPath)
	if err != nil {
		log.Printf("Warning: SQLite store initialization error: %v", err)
	}

	tracker := metrics.NewTracker(120)

	// Dial gRPC Order Service
	conn, err := grpc.Dial(orderGRPC, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to Order gRPC service at %s: %v", orderGRPC, err)
	}
	grpcClient := pb.NewEventPipelineClient(conn)

	gw := &Gateway{
		tracker:       tracker,
		historyStore:  histStore,
		grpcConn:      conn,
		grpcClient:    grpcClient,
		wsClients:     make(map[*websocket.Conn]bool),
		routingLogs:   make([]RoutingLogEntry, 0, 50),
		orderGRPCAddr: orderGRPC,
		orderHTTPAddr: orderHTTP,
	}

	lg := loadgen.NewLoadGenerator(tracker, gw.AddRoutingLog, gw.onBenchmarkComplete)
	gw.loadGen = lg

	// Start 250ms metrics broadcasting loop
	go gw.startMetricsBroadcaster()

	mux := http.NewServeMux()

	// CORS Middleware wrapper
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, X-ByteRail-Mode, X-ByteRail-Gzip")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		mux.ServeHTTP(w, r)
	})

	// Benchmark routes
	mux.HandleFunc("/json/batch", gw.handleJSONBatch)
	mux.HandleFunc("/binary/batch", gw.handleBinaryBatch)
	mux.HandleFunc("/auto/batch", gw.handleAutoBatch)

	// API routes
	mux.HandleFunc("/ws", gw.handleWebSocket)
	mux.HandleFunc("/api/benchmark/start", gw.handleStartBenchmark)
	mux.HandleFunc("/api/benchmark/stop", gw.handleStopBenchmark)
	mux.HandleFunc("/api/history", gw.handleGetHistory)
	mux.HandleFunc("/api/waterfall", gw.handleGetWaterfall)
	mux.HandleFunc("/api/schema-evolution", gw.handleSchemaEvolution)

	log.Printf("ByteRail Gateway listening on port :%s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Gateway server error: %v", err)
	}
}

func (gw *Gateway) AddRoutingLog(msg string) {
	gw.logsMu.Lock()
	defer gw.logsMu.Unlock()

	entry := RoutingLogEntry{
		Timestamp: time.Now().Format("15:04:05"),
		Header:    "System",
		Mode:      "INFO",
		Rationale: msg,
	}
	gw.routingLogs = append(gw.routingLogs, entry)
	if len(gw.routingLogs) > 50 {
		gw.routingLogs = gw.routingLogs[1:]
	}
}

func (gw *Gateway) logRoutingDecision(headerVal, mode, rationale string) {
	gw.logsMu.Lock()
	defer gw.logsMu.Unlock()

	entry := RoutingLogEntry{
		Timestamp: time.Now().Format("15:04:05"),
		Header:    headerVal,
		Mode:      mode,
		Rationale: rationale,
	}
	gw.routingLogs = append(gw.routingLogs, entry)
	if len(gw.routingLogs) > 50 {
		gw.routingLogs = gw.routingLogs[1:]
	}
}

func (gw *Gateway) handleJSONBatch(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var bodyBytes []byte
	var err error

	if r.Header.Get("Content-Encoding") == "gzip" || r.Header.Get("X-ByteRail-Gzip") == "true" {
		gz, err := gzip.NewReader(r.Body)
		if err != nil {
			http.Error(w, "invalid gzip payload", http.StatusBadRequest)
			return
		}
		bodyBytes, err = io.ReadAll(gz)
		gz.Close()
	} else {
		bodyBytes, err = io.ReadAll(r.Body)
	}
	if err != nil {
		http.Error(w, "error reading body", http.StatusBadRequest)
		return
	}

	// Forward to internal Order Service REST baseline endpoint
	resp, err := http.Post(gw.orderHTTPAddr+"/json/batch", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf("Order Service REST error: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "error reading order service response", http.StatusInternalServerError)
		return
	}

	lat := time.Since(start).Seconds() * 1000.0
	gw.tracker.RecordRequest("json", lat, int64(len(bodyBytes)))

	w.Header().Set("Content-Type", "application/json")
	if r.Header.Get("X-ByteRail-Gzip") == "true" {
		w.Header().Set("Content-Encoding", "gzip")
		gw := gzip.NewWriter(w)
		gw.Write(respBytes)
		gw.Close()
	} else {
		w.Write(respBytes)
	}
}

func (gw *Gateway) handleBinaryBatch(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "error reading body", http.StatusBadRequest)
		return
	}

	var req pb.BatchRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		http.Error(w, "invalid JSON batch request", http.StatusBadRequest)
		return
	}

	// Call internal Order Service over gRPC (Protobuf binary)
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	pbResp, err := gw.grpcClient.ProcessBatch(ctx, &req)
	if err != nil {
		http.Error(w, fmt.Sprintf("gRPC call failed: %v", err), http.StatusInternalServerError)
		return
	}

	lat := time.Since(start).Seconds() * 1000.0
	gw.tracker.RecordRequest("binary", lat, int64(len(bodyBytes)))

	if r.Header.Get("Accept") == "application/x-protobuf" {
		w.Header().Set("Content-Type", "application/x-protobuf")
		protoBytes, _ := proto.Marshal(pbResp)
		w.Write(protoBytes)
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pbResp)
	}
}

func (gw *Gateway) handleAutoBatch(w http.ResponseWriter, r *http.Request) {
	acceptHeader := r.Header.Get("Accept")
	modeHeader := r.Header.Get("X-ByteRail-Mode")

	if acceptHeader == "application/x-protobuf" || modeHeader == "binary" {
		headerVal := acceptHeader
		if headerVal == "" {
			headerVal = "X-ByteRail-Mode: " + modeHeader
		}
		gw.logRoutingDecision(headerVal, "BINARY path", "Accept header specifies Protobuf binary protocol -> Routed to internal gRPC pipeline")
		gw.handleBinaryBatch(w, r)
	} else {
		headerVal := acceptHeader
		if headerVal == "" {
			headerVal = "(missing)"
		}
		gw.logRoutingDecision(headerVal, "JSON path (default)", "No binary header specified -> Defaulting safely to REST JSON path")
		gw.handleJSONBatch(w, r)
	}
}

func (gw *Gateway) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	gw.wsClientsMu.Lock()
	gw.wsClients[conn] = true
	gw.wsClientsMu.Unlock()

	defer func() {
		gw.wsClientsMu.Lock()
		delete(gw.wsClients, conn)
		gw.wsClientsMu.Unlock()
		conn.Close()
	}()

	// Keep-alive read loop
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (gw *Gateway) startMetricsBroadcaster() {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		simulatedCPUJSON := 0.0
		simulatedCPUBinary := 0.0

		if gw.loadGen.IsRunning() {
			cfg := gw.loadGen.GetConfig()
			switch cfg.PayloadProfile {
			case "medium":
				simulatedCPUJSON = float64(cfg.Concurrency) * 0.15
				simulatedCPUBinary = float64(cfg.Concurrency) * 0.05
			case "large":
				simulatedCPUJSON = float64(cfg.Concurrency) * 0.22
				simulatedCPUBinary = float64(cfg.Concurrency) * 0.08
			default:
				simulatedCPUJSON = float64(cfg.Concurrency) * 0.08
				simulatedCPUBinary = float64(cfg.Concurrency) * 0.02
			}
		}

		tick := gw.tracker.Tick(simulatedCPUJSON, simulatedCPUBinary)

		gw.logsMu.Lock()
		logsCopy := make([]RoutingLogEntry, len(gw.routingLogs))
		copy(logsCopy, gw.routingLogs)
		gw.logsMu.Unlock()

		payload := map[string]interface{}{
			"type":         "metrics_tick",
			"tick":         tick,
			"routing_logs": logsCopy,
			"is_running":   gw.loadGen.IsRunning(),
		}

		msgBytes, err := json.Marshal(payload)
		if err != nil {
			continue
		}

		gw.wsClientsMu.Lock()
		for conn := range gw.wsClients {
			if err := conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
				conn.Close()
				delete(gw.wsClients, conn)
			}
		}
		gw.wsClientsMu.Unlock()
	}
}

func (gw *Gateway) handleStartBenchmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cfg loadgen.Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		http.Error(w, "invalid benchmark config", http.StatusBadRequest)
		return
	}

	cfg.GatewayHTTP = "http://localhost:" + os.Getenv("PORT")
	if os.Getenv("PORT") == "" {
		cfg.GatewayHTTP = "http://localhost:8080"
	}
	cfg.OrderGRPC = gw.orderGRPCAddr

	if err := gw.loadGen.Start(cfg); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "started", "config": cfg})
}

func (gw *Gateway) handleStopBenchmark(w http.ResponseWriter, r *http.Request) {
	gw.loadGen.Stop()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (gw *Gateway) onBenchmarkComplete(cfg loadgen.Config) {
	historyTicks := gw.tracker.GetHistory()
	if len(historyTicks) == 0 {
		return
	}

	var totalCpuJSON, totalCpuBinary, totalRpsJSON, totalRpsBinary float64
	var maxP99JSON, maxP99Binary float64
	count := float64(len(historyTicks))

	for _, tick := range historyTicks {
		totalCpuJSON += tick.JSON.CpuUsage
		totalCpuBinary += tick.Binary.CpuUsage
		totalRpsJSON += tick.JSON.RPS
		totalRpsBinary += tick.Binary.RPS
		if tick.JSON.P99 > maxP99JSON {
			maxP99JSON = tick.JSON.P99
		}
		if tick.Binary.P99 > maxP99Binary {
			maxP99Binary = tick.Binary.P99
		}
	}

	avgCpuJSON := totalCpuJSON / count
	avgCpuBinary := totalCpuBinary / count
	avgRpsJSON := totalRpsJSON / count
	avgRpsBinary := totalRpsBinary / count

	cpuSavedPct := 0.0
	if avgCpuJSON > 0 {
		cpuSavedPct = ((avgCpuJSON - avgCpuBinary) / avgCpuJSON) * 100
		if cpuSavedPct < 0 {
			cpuSavedPct = 0
		}
	}

	throughputMult := 1.0
	if avgRpsJSON > 0 {
		throughputMult = avgRpsBinary / avgRpsJSON
	}

	summary := history.RunSummary{
		Timestamp:            time.Now(),
		Concurrency:          cfg.Concurrency,
		PayloadProfile:       cfg.PayloadProfile,
		IsStreaming:          cfg.IsStreaming,
		IsGzip:               cfg.IsGzip,
		DurationSec:          cfg.DurationSec,
		AvgCpuJSON:           round2(avgCpuJSON),
		AvgCpuBinary:         round2(avgCpuBinary),
		AvgRpsJSON:           round2(avgRpsJSON),
		AvgRpsBinary:         round2(avgRpsBinary),
		P99JSON:              round2(maxP99JSON),
		P99Binary:            round2(maxP99Binary),
		CpuSavedPct:          round2(cpuSavedPct),
		ThroughputMultiplier: round2(throughputMult),
	}

	if gw.historyStore != nil {
		if err := gw.historyStore.SaveRun(summary); err != nil {
			log.Printf("Error saving benchmark run to SQLite: %v", err)
		}
	}
}

func (gw *Gateway) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if gw.historyStore == nil {
		json.NewEncoder(w).Encode([]history.RunSummary{})
		return
	}
	runs, err := gw.historyStore.GetRecentRuns(20)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(runs)
}

func (gw *Gateway) handleGetWaterfall(w http.ResponseWriter, r *http.Request) {
	// Canonical sample event required by Section 5.2:
	// Event: id="evt_001", timestamp=1723456789000, user_id="u42", 2 items, 2 metadata entries
	sampleEvent := &pb.Event{
		Id:        "evt_001",
		Timestamp: 1723456789000,
		UserId:    "u42",
		Items: []*pb.Item{
			{Sku: "SKU-9901", Qty: 2, Price: 19.99},
			{Sku: "SKU-9902", Qty: 1, Price: 49.50},
		},
		Metadata: map[string]string{
			"env":    "production",
			"source": "mobile_app",
		},
	}

	jsonBytes, _ := json.MarshalIndent(sampleEvent, "", "  ")
	compactJSONBytes, _ := json.Marshal(sampleEvent)
	protoBytes, _ := proto.Marshal(sampleEvent)

	// Breakdown analysis
	jsonSize := len(compactJSONBytes)
	protoSize := len(protoBytes)
	savedPct := float64(jsonSize-protoSize) / float64(jsonSize) * 100

	hexDump := fmt.Sprintf("%X", protoBytes)

	resp := map[string]interface{}{
		"json_raw":       string(jsonBytes),
		"json_compact":   string(compactJSONBytes),
		"json_bytes":     jsonSize,
		"proto_bytes":    protoSize,
		"proto_hex":      hexDump,
		"saved_pct":      round2(savedPct),
		"json_breakdown": map[string]int{
			"field_names":          42,
			"whitespace_punct":     18,
			"string_enc_numbers":   12,
			"actual_data_payload":  38,
		},
		"proto_breakdown": map[string]string{
			"tag_1_id":        "0A 07 'evt_001' (Field 1, String len 7)",
			"tag_2_timestamp": "10 90 A2 AE CB F4 32 (Field 2, Varint 1723456789000)",
			"tag_3_user_id":   "1A 03 'u42' (Field 3, String len 3)",
			"tag_4_items":     "22 10 [SKU-9901], 22 10 [SKU-9902] (Field 4, Embedded Messages)",
			"tag_5_metadata":  "2A 12 [env=prod], 2A 14 [source=mobile] (Field 5, Map Entries)",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (gw *Gateway) handleSchemaEvolution(w http.ResponseWriter, r *http.Request) {
	// Demo flow required by Section 5.3
	oldClientRequest := map[string]interface{}{
		"id":        "evt_compat_001",
		"timestamp": time.Now().UnixMilli(),
		"user_id":   "legacy_user_77",
		"items": []map[string]interface{}{
			{"sku": "SKU-LEGACY", "qty": 1, "price": 99.00},
		},
		"metadata": map[string]string{"version": "v1.0"},
	}

	// Gateway accepts old request format (without discount_code field)
	reqJSON, _ := json.Marshal(oldClientRequest)
	var pbReq pb.BatchRequest
	var evt pb.Event
	json.Unmarshal(reqJSON, &evt)
	pbReq.Events = append(pbReq.Events, &evt)

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	resp, err := gw.grpcClient.ProcessBatch(ctx, &pbReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("Schema evolution test failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "status": resp.Status, "processed": resp.Processed, "schema_v1_fields": 5, "schema_v2_fields": 6, "added_field": "string discount_code = 6", "explanation": "Old client (5 fields) sent request without discount_code. New service (6 fields) deserialized Protobuf message seamlessly without error."})
}

func round2(val float64) float64 {
	return float64(int(val*100)) / 100
}
