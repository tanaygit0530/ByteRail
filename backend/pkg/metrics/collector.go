package metrics

import (
	"math"

	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type PathMetric struct {
	TotalRequests int64     `json:"total_requests"`
	RPS           float64   `json:"rps"`
	P50           float64   `json:"p50_ms"`
	P95           float64   `json:"p95_ms"`
	P99           float64   `json:"p99_ms"`
	CpuUsage      float64   `json:"cpu_pct"`
	BytesTotal    int64     `json:"bytes_total"`
}

type TickMetrics struct {
	Timestamp int64      `json:"timestamp"`
	JSON      PathMetric `json:"json"`
	Binary    PathMetric `json:"binary"`
	Active    bool       `json:"active"`
}

type Tracker struct {
	mu            sync.Mutex
	jsonLatencies []float64
	binLatencies  []float64

	jsonReqCount  atomic.Int64
	binReqCount   atomic.Int64

	jsonBytes     atomic.Int64
	binBytes      atomic.Int64

	lastTick      time.Time
	lastJSONCount int64
	lastBinCount  int64

	ringBuffer    []TickMetrics
	maxRingLen    int
}

func NewTracker(maxRingLen int) *Tracker {
	if maxRingLen <= 0 {
		maxRingLen = 120 // default 120 ticks (30 seconds at 250ms ticks)
	}
	return &Tracker{
		jsonLatencies: make([]float64, 0, 10000),
		binLatencies:  make([]float64, 0, 10000),
		lastTick:      time.Now(),
		ringBuffer:    make([]TickMetrics, 0, maxRingLen),
		maxRingLen:    maxRingLen,
	}
}

func (t *Tracker) RecordRequest(path string, latencyMs float64, sizeBytes int64) {
	if path == "json" {
		t.jsonReqCount.Add(1)
		t.jsonBytes.Add(sizeBytes)
		t.mu.Lock()
		t.jsonLatencies = append(t.jsonLatencies, latencyMs)
		t.mu.Unlock()
	} else {
		t.binReqCount.Add(1)
		t.binBytes.Add(sizeBytes)
		t.mu.Lock()
		t.binLatencies = append(t.binLatencies, latencyMs)
		t.mu.Unlock()
	}
}

func (t *Tracker) Tick(simulatedCPUJSON, simulatedCPUBinary float64) TickMetrics {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(t.lastTick).Seconds()
	if elapsed <= 0 {
		elapsed = 0.250
	}
	t.lastTick = now

	currentJSONCount := t.jsonReqCount.Load()
	currentBinCount := t.binReqCount.Load()

	deltaJSON := currentJSONCount - t.lastJSONCount
	deltaBin := currentBinCount - t.lastBinCount

	t.lastJSONCount = currentJSONCount
	t.lastBinCount = currentBinCount

	rpsJSON := float64(deltaJSON) / elapsed
	rpsBin := float64(deltaBin) / elapsed

	p50JSON, p95JSON, p99JSON := calcPercentiles(t.jsonLatencies)
	p50Bin, p95Bin, p99Bin := calcPercentiles(t.binLatencies)

	// Clear sliding window latencies for next tick
	t.jsonLatencies = t.jsonLatencies[:0]
	t.binLatencies = t.binLatencies[:0]

	// Calculate CPU usage based on load if simulated, or real estimate
	cpuJSON := math.Min(100.0, rpsJSON*0.08 + simulatedCPUJSON)
	cpuBin := math.Min(100.0, rpsBin*0.025 + simulatedCPUBinary)

	if deltaJSON == 0 {
		cpuJSON = 0
	}
	if deltaBin == 0 {
		cpuBin = 0
	}

	tick := TickMetrics{
		Timestamp: now.UnixMilli(),
		Active:    (deltaJSON > 0 || deltaBin > 0),
		JSON: PathMetric{
			TotalRequests: currentJSONCount,
			RPS:           round2(rpsJSON),
			P50:           round2(p50JSON),
			P95:           round2(p95JSON),
			P99:           round2(p99JSON),
			CpuUsage:      round2(cpuJSON),
			BytesTotal:    t.jsonBytes.Load(),
		},
		Binary: PathMetric{
			TotalRequests: currentBinCount,
			RPS:           round2(rpsBin),
			P50:           round2(p50Bin),
			P95:           round2(p95Bin),
			P99:           round2(p99Bin),
			CpuUsage:      round2(cpuBin),
			BytesTotal:    t.binBytes.Load(),
		},
	}

	t.ringBuffer = append(t.ringBuffer, tick)
	if len(t.ringBuffer) > t.maxRingLen {
		t.ringBuffer = t.ringBuffer[1:]
	}

	return tick
}

func (t *Tracker) GetHistory() []TickMetrics {
	t.mu.Lock()
	defer t.mu.Unlock()
	res := make([]TickMetrics, len(t.ringBuffer))
	copy(res, t.ringBuffer)
	return res
}

func (t *Tracker) Reset() {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.jsonReqCount.Store(0)
	t.binReqCount.Store(0)
	t.jsonBytes.Store(0)
	t.binBytes.Store(0)

	t.lastJSONCount = 0
	t.lastBinCount = 0
	t.jsonLatencies = t.jsonLatencies[:0]
	t.binLatencies = t.binLatencies[:0]
	t.ringBuffer = t.ringBuffer[:0]
	t.lastTick = time.Now()
}

func calcPercentiles(latencies []float64) (p50, p95, p99 float64) {
	n := len(latencies)
	if n == 0 {
		return 0, 0, 0
	}
	sort.Float64s(latencies)

	p50Idx := int(float64(n) * 0.50)
	p95Idx := int(float64(n) * 0.95)
	p99Idx := int(float64(n) * 0.99)

	if p50Idx >= n {
		p50Idx = n - 1
	}
	if p95Idx >= n {
		p95Idx = n - 1
	}
	if p99Idx >= n {
		p99Idx = n - 1
	}

	return latencies[p50Idx], latencies[p95Idx], latencies[p99Idx]
}

func round2(val float64) float64 {
	return math.Round(val*100) / 100
}
