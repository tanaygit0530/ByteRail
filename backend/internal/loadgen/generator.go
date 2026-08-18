package loadgen

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"

	"byterail/pkg/metrics"
	pb "byterail/pkg/proto/pipeline"
)

type Config struct {
	Concurrency    int    `json:"concurrency"`
	PayloadProfile string `json:"payload_profile"` // "tiny", "medium", "large"
	DurationSec    int    `json:"duration_sec"`
	IsStreaming    bool   `json:"is_streaming"`
	IsGzip         bool   `json:"is_gzip"`
	GatewayHTTP    string `json:"gateway_http"`
	OrderGRPC      string `json:"order_grpc"`
}

type LoadGenerator struct {
	mu           sync.Mutex
	running      atomic.Bool
	cancel       context.CancelFunc
	config       Config
	phase        atomic.Value // "idle", "warmup", "json", "binary"
	tracker      *metrics.Tracker
	routingLogCb func(message string)
	onComplete   func(cfg Config)
}

func NewLoadGenerator(tracker *metrics.Tracker, routingLogCb func(string), onComplete func(Config)) *LoadGenerator {
	lg := &LoadGenerator{
		tracker:      tracker,
		routingLogCb: routingLogCb,
		onComplete:   onComplete,
	}
	lg.phase.Store("idle")
	return lg
}

func (lg *LoadGenerator) IsRunning() bool {
	return lg.running.Load()
}

func (lg *LoadGenerator) GetPhase() string {
	if p, ok := lg.phase.Load().(string); ok {
		return p
	}
	return "idle"
}

func (lg *LoadGenerator) GetConfig() Config {
	lg.mu.Lock()
	defer lg.mu.Unlock()
	return lg.config
}

func (lg *LoadGenerator) Start(cfg Config) error {
	if lg.running.Load() {
		return fmt.Errorf("benchmark already running")
	}

	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 10
	}
	if cfg.DurationSec <= 0 {
		cfg.DurationSec = 30
	}
	if cfg.GatewayHTTP == "" {
		cfg.GatewayHTTP = "http://localhost:8080"
	}
	if cfg.OrderGRPC == "" {
		cfg.OrderGRPC = "localhost:50051"
	}

	lg.mu.Lock()
	lg.config = cfg
	totalTimeSec := cfg.DurationSec + 4
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(totalTimeSec)*time.Second)
	lg.cancel = cancel
	lg.mu.Unlock()

	lg.running.Store(true)
	lg.phase.Store("warmup")
	lg.tracker.Reset()

	lg.routingLogCb(fmt.Sprintf("🚀 Starting Benchmark: Concurrency=%d, Profile=%s, PhaseDuration=%ds/path, Streaming=%v, Gzip=%v",
		cfg.Concurrency, cfg.PayloadProfile, cfg.DurationSec/2, cfg.IsStreaming, cfg.IsGzip))

	go lg.runPhasedSequence(ctx, cfg)

	return nil
}

func (lg *LoadGenerator) Stop() {
	lg.mu.Lock()
	if lg.cancel != nil {
		lg.cancel()
	}
	lg.mu.Unlock()
	lg.running.Store(false)
	lg.phase.Store("idle")
	lg.routingLogCb("🛑 Benchmark stopped by user.")
}

func (lg *LoadGenerator) runPhasedSequence(ctx context.Context, cfg Config) {
	defer func() {
		lg.running.Store(false)
		lg.phase.Store("idle")
		lg.routingLogCb("🏁 Benchmark finished.")
		if lg.onComplete != nil {
			lg.onComplete(cfg)
		}
	}()

	sampleBatch := GenerateBatchPayload(cfg.PayloadProfile)
	jsonBytes, _ := json.Marshal(sampleBatch)
	protoBytes, _ := proto.Marshal(sampleBatch)

	client := &http.Client{
		Transport: &http.Transport{
			MaxIdleConnsPerHost: cfg.Concurrency * 2,
			MaxIdleConns:        cfg.Concurrency * 4,
			IdleConnTimeout:     90 * time.Second,
		},
		Timeout: 5 * time.Second,
	}

	// -------------------------------------------------------------
	// PHASE 1: WARMUP (2 Seconds)
	// -------------------------------------------------------------
	lg.phase.Store("warmup")
	lg.routingLogCb("🔥 Phase 1/3: Warming up JSON & Binary connections...")
	warmupCtx, warmupCancel := context.WithTimeout(ctx, 2*time.Second)
	lg.executeWorkerPool(warmupCtx, client, cfg, "json", jsonBytes, protoBytes, sampleBatch, true)
	lg.executeWorkerPool(warmupCtx, client, cfg, "binary", jsonBytes, protoBytes, sampleBatch, true)
	warmupCancel()

	if ctx.Err() != nil {
		return
	}

	phaseSec := cfg.DurationSec / 2
	if phaseSec < 5 {
		phaseSec = 5
	}

	// Reset tracker metrics after warmup
	lg.tracker.Reset()

	// -------------------------------------------------------------
	// PHASE 2: JSON PATH MEASUREMENT
	// -------------------------------------------------------------
	lg.phase.Store("json")
	lg.routingLogCb(fmt.Sprintf("📊 Phase 2/3: Measuring JSON Path (%ds)...", phaseSec))
	jsonCtx, jsonCancel := context.WithTimeout(ctx, time.Duration(phaseSec)*time.Second)
	lg.executeWorkerPool(jsonCtx, client, cfg, "json", jsonBytes, protoBytes, sampleBatch, false)
	jsonCancel()

	if ctx.Err() != nil {
		return
	}

	time.Sleep(500 * time.Millisecond)

	// -------------------------------------------------------------
	// PHASE 3: BINARY PATH MEASUREMENT
	// -------------------------------------------------------------
	lg.phase.Store("binary")
	lg.routingLogCb(fmt.Sprintf("⚡ Phase 3/3: Measuring Binary Path (%ds)...", phaseSec))
	binCtx, binCancel := context.WithTimeout(ctx, time.Duration(phaseSec)*time.Second)
	lg.executeWorkerPool(binCtx, client, cfg, "binary", jsonBytes, protoBytes, sampleBatch, false)
	binCancel()
}

func (lg *LoadGenerator) executeWorkerPool(ctx context.Context, client *http.Client, cfg Config, pathType string, jsonBytes, protoBytes []byte, sampleBatch *pb.BatchRequest, isWarmup bool) {
	var wg sync.WaitGroup

	if pathType == "json" {
		for i := 0; i < cfg.Concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for {
					select {
					case <-ctx.Done():
						return
					default:
						start := time.Now()
						var reqBody io.Reader = bytes.NewReader(jsonBytes)
						contentLen := int64(len(jsonBytes))

						req, err := http.NewRequestWithContext(ctx, "POST", cfg.GatewayHTTP+"/json/batch", reqBody)
						if err != nil {
							time.Sleep(5 * time.Millisecond)
							continue
						}

						req.Header.Set("Content-Type", "application/json")
						if cfg.IsGzip {
							var buf bytes.Buffer
							gw := gzip.NewWriter(&buf)
							gw.Write(jsonBytes)
							gw.Close()
							reqBody = &buf
							req, _ = http.NewRequestWithContext(ctx, "POST", cfg.GatewayHTTP+"/json/batch", reqBody)
							req.Header.Set("Content-Type", "application/json")
							req.Header.Set("Content-Encoding", "gzip")
							req.Header.Set("X-ByteRail-Gzip", "true")
							contentLen = int64(buf.Len())
						}

						resp, err := client.Do(req)
						elapsed := time.Since(start)
						latMs := float64(elapsed.Nanoseconds()) / 1e6

						if err == nil {
							io.Copy(io.Discard, resp.Body)
							resp.Body.Close()
							if !isWarmup {
								lg.tracker.RecordRequest("json", latMs, contentLen, resp.StatusCode >= 400)
							}
						} else {
							if !isWarmup {
								lg.tracker.RecordRequest("json", 0, contentLen, true)
							}
							time.Sleep(5 * time.Millisecond)
						}
					}
				}
			}()
		}
	} else {
		// Binary Path
		if cfg.IsStreaming {
			for i := 0; i < cfg.Concurrency; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					conn, err := grpc.Dial(cfg.OrderGRPC, grpc.WithTransportCredentials(insecure.NewCredentials()))
					if err != nil {
						return
					}
					defer conn.Close()

					grpcClient := pb.NewEventPipelineClient(conn)
					stream, err := grpcClient.ProcessBatchStream(ctx)
					if err != nil {
						return
					}

					for {
						select {
						case <-ctx.Done():
							stream.CloseSend()
							return
						default:
							start := time.Now()
							if err := stream.Send(sampleBatch); err != nil {
								if !isWarmup {
									lg.tracker.RecordRequest("binary", 0, int64(len(protoBytes)), true)
								}
								return
							}
							_, err := stream.Recv()
							elapsed := time.Since(start)
							latMs := float64(elapsed.Nanoseconds()) / 1e6

							if !isWarmup {
								lg.tracker.RecordRequest("binary", latMs, int64(len(protoBytes)), err != nil)
							}
							if err != nil {
								return
							}
						}
					}
				}()
			}
		} else {
			for i := 0; i < cfg.Concurrency; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					for {
						select {
						case <-ctx.Done():
							return
						default:
							start := time.Now()
							reqBody := bytes.NewReader(jsonBytes)
							req, err := http.NewRequestWithContext(ctx, "POST", cfg.GatewayHTTP+"/binary/batch", reqBody)
							if err != nil {
								time.Sleep(5 * time.Millisecond)
								continue
							}

							req.Header.Set("Content-Type", "application/json")
							req.Header.Set("Accept", "application/x-protobuf")

							resp, err := client.Do(req)
							elapsed := time.Since(start)
							latMs := float64(elapsed.Nanoseconds()) / 1e6

							if err == nil {
								io.Copy(io.Discard, resp.Body)
								resp.Body.Close()
								if !isWarmup {
									lg.tracker.RecordRequest("binary", latMs, int64(len(protoBytes)), resp.StatusCode >= 400)
								}
							} else {
								if !isWarmup {
									lg.tracker.RecordRequest("binary", 0, int64(len(protoBytes)), true)
								}
								time.Sleep(5 * time.Millisecond)
							}
						}
					}
				}()
			}
		}
	}

	wg.Wait()
}

func GenerateBatchPayload(profile string) *pb.BatchRequest {
	numEvents := 1
	numItems := 1
	numMeta := 0

	switch profile {
	case "medium":
		numEvents = 10
		numItems = 3
		numMeta = 2
	case "large":
		numEvents = 200
		numItems = 5
		numMeta = 5
	}

	events := make([]*pb.Event, 0, numEvents)
	for i := 0; i < numEvents; i++ {
		items := make([]*pb.Item, 0, numItems)
		for j := 0; j < numItems; j++ {
			items = append(items, &pb.Item{
				Sku:   fmt.Sprintf("SKU-%04d", j+1),
				Qty:   int32(j + 1),
				Price: float64(19.99 + float64(j*5)),
			})
		}

		meta := make(map[string]string)
		for k := 0; k < numMeta; k++ {
			meta[fmt.Sprintf("meta_key_%d", k+1)] = fmt.Sprintf("meta_val_%d", k+1)
		}

		events = append(events, &pb.Event{
			Id:        fmt.Sprintf("evt_%04d", i+1),
			Timestamp: time.Now().UnixMilli(),
			UserId:    fmt.Sprintf("usr_%03d", (i%20)+1),
			Items:     items,
			Metadata:  meta,
		})
	}

	return &pb.BatchRequest{
		Events:        events,
		CorrelationId: "corr_benchmark_req_99812",
	}
}
