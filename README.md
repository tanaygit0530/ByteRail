# ByteRail — Zero-Copy Binary API Gateway

ByteRail is a high-performance API gateway demonstration built in Go. It accepts JSON from external HTTP clients, converts it to binary Protocol Buffers over gRPC for internal service-to-service communication, and proves the performance win with a live, real-time benchmark dashboard comparing the JSON REST path against the binary gRPC path under identical simulated load.

---

## 🚀 Key Features & Highlights

1. **Live Side-by-Side Benchmark Dashboard**:
   - Synchronized real-time Recharts tracking **CPU Utilization %** and **Throughput (Requests/sec)** side by side.
   - Live 250ms WebSocket push updates from Gateway.
   - Stepped/slider concurrency control (1 → 50 → 200 → 500 concurrent workers).
   - Configurable payload profiles (**Tiny**, **Medium**, **Large**).
   - End-of-run summary banner computing CPU savings % and throughput multiplier, with one-click CSV export.

2. **Byte-by-Byte Payload Waterfall**:
   - Hero visual breaking down raw JSON string byte allocations (field names, quotes, punctuation, string-encoded numbers) vs Protobuf binary wire format hex dump and byte-grid.
   - Proves Protobuf's ~63% size compression visually.

3. **Automatic Mode Switcher & Routing Log**:
   - Gateway inspects `Accept` and `X-ByteRail-Mode` headers.
   - Routes `Accept: application/x-protobuf` or `X-ByteRail-Mode: binary` to internal gRPC pipeline, defaulting safely to JSON path otherwise.
   - Live-scrolling terminal log rendering decision timestamps and rationale.

4. **Schema Evolution & Backward Compatibility Demo**:
   - Interactive scripted UI demo proving old v1 clients (5 fields) process seamlessly against updated v2 services (6 fields, with optional `discount_code = 6`).

5. **Sliding-Window Latency Percentiles (p50/p95/p99)**:
   - 10-second sliding window latency statistics calculated every 250ms tick.
   - Highlights the dramatic p99 tail-latency gap under GC pressure.

6. **Gzip Compression Trade-off (JSON Path)**:
   - Toggleable Gzip compression on JSON path.
   - Proves JSON gzip saves bandwidth (~38%) but increases CPU overhead (+15%), while Protobuf Binary saves 63% bandwidth with lower CPU usage.

7. **Bidirectional Streaming gRPC**:
   - Streaming mode toggle pushing continuous batch sequences over persistent bidirectional gRPC streams (`ProcessBatchStream`).

8. **SQLite Run History**:
   - Saves completed benchmark run summaries to SQLite (`modernc.org/sqlite` pure Go) only after benchmark completion, preventing disk I/O pollution during active runs.

---

## 🛠 Tech Stack

- **Gateway**: Go (`net/http` + `google.golang.org/grpc` + WebSocket)
- **Internal Protocol**: Protocol Buffers v3 + gRPC
- **Backend Services**: Order Service & Inventory Service (Go gRPC servers)
- **Load Generator**: Custom Go worker-pool program
- **Database**: SQLite via `modernc.org/sqlite` (Run History only)
- **Frontend**: React + TypeScript + Tailwind CSS + Recharts + Lucide Icons
- **Containerization**: Docker Compose (`docker compose up`)

---

## 🚦 One-Command Quick Start

### Docker Compose
```bash
docker compose up
```
Open **`http://localhost:3000`** in your browser to launch the live benchmark dashboard.

### Local Development (Alternative)
```bash
# Terminal 1: Order Service
cd backend && go run ./cmd/order

# Terminal 2: Inventory Service
cd backend && go run ./cmd/inventory

# Terminal 3: Gateway
cd backend && go run ./cmd/gateway

# Terminal 4: Frontend Dashboard
cd frontend && npm install && npm run dev
```

---

## 📐 Architecture & Scientific Fairness

```
External Client (JSON / Protobuf)
               │
               ▼
┌──────────────────────────────┐
│       ByteRail Gateway       │
│  - REST /json/*  (JSON path) │ ──> Internal REST Backend Call
│  - REST /binary/*(gRPC path) │ ──> Protobuf Struct ──> gRPC Call
│  - Auto Header Router        │
│  - Metrics Ring Buffer       │ ──> WebSocket ──> Live React Dashboard
└──────────────┬───────────────┘
               │ gRPC (Protobuf binary)
        ┌──────┴──────┐
        ▼             ▼
 [Order Service] [Inventory Service]
```

> **Fairness Guarantee**: Both JSON and Binary paths execute **identical business validation, SKU item accumulation, and batch response logic** inside Order Service and Inventory Service. The only difference is the serialization format and transport protocol.
# ByteRail
