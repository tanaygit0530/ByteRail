package metrics

import (
	"fmt"
	"log"
	"math"
	"runtime"
	"sort"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type PathMetric struct {
	TotalRequests int64   `json:"total_requests"`
	Errors        int64   `json:"errors"`
	RPS           float64 `json:"rps"`
	P50           float64 `json:"p50_ms"`
	P95           float64 `json:"p95_ms"`
	P99           float64 `json:"p99_ms"`
	CpuUsage      float64 `json:"cpu_pct"`
	BytesTotal    int64   `json:"bytes_total"`
	SampleCount   int     `json:"sample_count"`
}

type FairnessResult struct {
	IsValid bool   `json:"is_valid"`
	Reason  string `json:"reason"`
}

type TickMetrics struct {
	Timestamp int64          `json:"timestamp"`
	Phase     string         `json:"phase"` // "warmup", "json", "binary", "idle"
	JSON      PathMetric     `json:"json"`
	Binary    PathMetric     `json:"binary"`
	Active    bool           `json:"active"`
	Fairness  FairnessResult `json:"fairness"`
}

type LatencySample struct {
	Timestamp time.Time
	LatencyMs float64
}

type Tracker struct {
	mu          sync.Mutex
	jsonSamples []LatencySample
	binSamples  []LatencySample

	jsonReqCount atomic.Int64
	binReqCount  atomic.Int64

	jsonErrCount atomic.Int64
	binErrCount  atomic.Int64

	jsonBytes atomic.Int64
	binBytes  atomic.Int64

	lastTick      time.Time
	lastJSONCount int64
	lastBinCount  int64

	lastCpuTimeNs int64

	jsonPhaseCpuSum float64
	jsonPhaseRpsSum float64
	jsonPhaseCount  float64

	binPhaseCpuSum float64
	binPhaseRpsSum float64
	binPhaseCount  float64

	ringBuffer  []TickMetrics
	maxRingLen  int
	lastLogTime time.Time
}

func NewTracker(maxRingLen int) *Tracker {
	if maxRingLen <= 0 {
		maxRingLen = 120 // default 120 ticks (30 seconds at 250ms ticks)
	}
	return &Tracker{
		jsonSamples:   make([]LatencySample, 0, 10000),
		binSamples:    make([]LatencySample, 0, 10000),
		lastTick:      time.Now(),
		lastCpuTimeNs: getProcessCpuTimeNs(),
		ringBuffer:    make([]TickMetrics, 0, maxRingLen),
		maxRingLen:    maxRingLen,
		lastLogTime:   time.Now(),
	}
}

func (t *Tracker) RecordRequest(path string, latencyMs float64, sizeBytes int64, isError bool) {
	now := time.Now()
	if path == "json" {
		t.jsonReqCount.Add(1)
		if isError {
			t.jsonErrCount.Add(1)
		} else if latencyMs > 0 {
			t.jsonBytes.Add(sizeBytes)
			t.mu.Lock()
			t.jsonSamples = append(t.jsonSamples, LatencySample{Timestamp: now, LatencyMs: latencyMs})
			t.mu.Unlock()
		}
	} else {
		t.binReqCount.Add(1)
		if isError {
			t.binErrCount.Add(1)
		} else if latencyMs > 0 {
			t.binBytes.Add(sizeBytes)
			t.mu.Lock()
			t.binSamples = append(t.binSamples, LatencySample{Timestamp: now, LatencyMs: latencyMs})
			t.mu.Unlock()
		}
	}
}

func (t *Tracker) Tick(phase string) TickMetrics {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(t.lastTick).Seconds()
	if elapsed <= 0 {
		elapsed = 0.250
	}
	t.lastTick = now

	// Calculate real process CPU usage during elapsed window
	currentCpuNs := getProcessCpuTimeNs()
	deltaCpuNs := currentCpuNs - t.lastCpuTimeNs
	t.lastCpuTimeNs = currentCpuNs

	elapsedNs := float64(elapsed * 1e9)
	numCPU := float64(runtime.NumCPU())
	if numCPU <= 0 {
		numCPU = 1.0
	}

	// Process CPU utilization percentage (0 - 100%)
	realCpuPct := 0.0
	if elapsedNs > 0 {
		realCpuPct = (float64(deltaCpuNs) / (elapsedNs * numCPU)) * 100.0
		if realCpuPct < 0 {
			realCpuPct = 0
		}
		if realCpuPct > 100.0 {
			realCpuPct = 100.0
		}
	}

	currentJSONCount := t.jsonReqCount.Load()
	currentBinCount := t.binReqCount.Load()

	deltaJSON := currentJSONCount - t.lastJSONCount
	deltaBin := currentBinCount - t.lastBinCount

	t.lastJSONCount = currentJSONCount
	t.lastBinCount = currentBinCount

	instantRpsJSON := float64(deltaJSON) / elapsed
	instantRpsBin := float64(deltaBin) / elapsed

	// Accumulate phase averages during active execution
	if phase == "json" && deltaJSON > 0 {
		t.jsonPhaseCpuSum += realCpuPct
		t.jsonPhaseRpsSum += instantRpsJSON
		t.jsonPhaseCount++
	} else if phase == "binary" && deltaBin > 0 {
		t.binPhaseCpuSum += realCpuPct
		t.binPhaseRpsSum += instantRpsBin
		t.binPhaseCount++
	}

	// Compute phase-wide average or active CPU/RPS
	cpuJSON := 0.0
	rpsJSON := 0.0
	if t.jsonPhaseCount > 0 {
		cpuJSON = t.jsonPhaseCpuSum / t.jsonPhaseCount
		rpsJSON = t.jsonPhaseRpsSum / t.jsonPhaseCount
	} else if deltaJSON > 0 {
		cpuJSON = realCpuPct
		rpsJSON = instantRpsJSON
	}

	cpuBin := 0.0
	rpsBin := 0.0
	if t.binPhaseCount > 0 {
		cpuBin = t.binPhaseCpuSum / t.binPhaseCount
		rpsBin = t.binPhaseRpsSum / t.binPhaseCount
	} else if deltaBin > 0 {
		cpuBin = realCpuPct
		rpsBin = instantRpsBin
	}

	// Extract active latency samples from 10-minute window (retains samples across benchmark run)
	windowDuration := 10 * time.Minute
	jsonLats := extractValidLatencies(t.jsonSamples, windowDuration)
	binLats := extractValidLatencies(t.binSamples, windowDuration)

	p50JSON, p95JSON, p99JSON := calcPercentiles(jsonLats)
	p50Bin, p95Bin, p99Bin := calcPercentiles(binLats)

	fairness := evaluateFairnessInternal(currentJSONCount, currentBinCount, t.jsonErrCount.Load(), t.binErrCount.Load())

	// Debug Log Validation (Requirement 1 & 9)
	if now.Sub(t.lastLogTime) >= 2*time.Second && (deltaJSON > 0 || deltaBin > 0 || phase == "binary") {
		t.lastLogTime = now
		log.Printf("[DIAGNOSTIC] Phase: %s | JSON: Reqs=%d (Errs=%d, Samples=%d, AvgCPU=%.1f%%, AvgRPS=%.1f, p50=%.2fms, p99=%.2fms) | Binary: Reqs=%d (Errs=%d, Samples=%d, AvgCPU=%.1f%%, AvgRPS=%.1f, p50=%.2fms, p99=%.2fms)",
			phase, currentJSONCount, t.jsonErrCount.Load(), len(jsonLats), cpuJSON, rpsJSON, p50JSON, p99JSON,
			currentBinCount, t.binErrCount.Load(), len(binLats), cpuBin, rpsBin, p50Bin, p99Bin)
	}

	tick := TickMetrics{
		Timestamp: now.UnixMilli(),
		Phase:     phase,
		Active:    (deltaJSON > 0 || deltaBin > 0),
		Fairness:  fairness,
		JSON: PathMetric{
			TotalRequests: currentJSONCount,
			Errors:        t.jsonErrCount.Load(),
			RPS:           round2(rpsJSON),
			P50:           round2(p50JSON),
			P95:           round2(p95JSON),
			P99:           round2(p99JSON),
			CpuUsage:      round2(cpuJSON),
			BytesTotal:    t.jsonBytes.Load(),
			SampleCount:   len(jsonLats),
		},
		Binary: PathMetric{
			TotalRequests: currentBinCount,
			Errors:        t.binErrCount.Load(),
			RPS:           round2(rpsBin),
			P50:           round2(p50Bin),
			P95:           round2(p95Bin),
			P99:           round2(p99Bin),
			CpuUsage:      round2(cpuBin),
			BytesTotal:    t.binBytes.Load(),
			SampleCount:   len(binLats),
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
	t.jsonErrCount.Store(0)
	t.binErrCount.Store(0)
	t.jsonBytes.Store(0)
	t.binBytes.Store(0)

	t.lastJSONCount = 0
	t.lastBinCount = 0

	t.jsonPhaseCpuSum = 0
	t.jsonPhaseRpsSum = 0
	t.jsonPhaseCount = 0

	t.binPhaseCpuSum = 0
	t.binPhaseRpsSum = 0
	t.binPhaseCount = 0

	t.jsonSamples = t.jsonSamples[:0]
	t.binSamples = t.binSamples[:0]
	t.ringBuffer = t.ringBuffer[:0]
	t.lastTick = time.Now()
	t.lastCpuTimeNs = getProcessCpuTimeNs()
}

func evaluateFairnessInternal(jsonCount, binCount, jsonErr, binErr int64) FairnessResult {
	if jsonCount < 5 || binCount < 5 {
		return FairnessResult{
			IsValid: false,
			Reason:  "Benchmark Validation Required — Awaiting complete path metrics",
		}
	}

	jsonErrRate := float64(jsonErr) / float64(jsonCount)
	binErrRate := float64(binErr) / float64(binCount)

	if jsonErrRate > 0.05 || binErrRate > 0.05 {
		return FairnessResult{
			IsValid: false,
			Reason:  fmt.Sprintf("Benchmark Invalid — High error rate detected (JSON: %.1f%%, Binary: %.1f%%)", jsonErrRate*100, binErrRate*100),
		}
	}

	return FairnessResult{
		IsValid: true,
		Reason:  "Benchmark Valid — Real measurements verified across both execution paths",
	}
}

func extractValidLatencies(samples []LatencySample, maxAge time.Duration) []float64 {
	now := time.Now()
	res := make([]float64, 0, len(samples))
	for _, s := range samples {
		if s.LatencyMs > 0 && now.Sub(s.Timestamp) <= maxAge {
			res = append(res, s.LatencyMs)
		}
	}
	return res
}

func getProcessCpuTimeNs() int64 {
	var usage syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &usage); err == nil {
		utimeNs := usage.Utime.Sec*1e9 + int64(usage.Utime.Usec)*1000
		stimeNs := usage.Stime.Sec*1e9 + int64(usage.Stime.Usec)*1000
		return utimeNs + stimeNs
	}
	return time.Now().UnixNano()
}

func calcPercentiles(latencies []float64) (p50, p95, p99 float64) {
	n := len(latencies)
	if n == 0 {
		return 0, 0, 0
	}
	cp := make([]float64, n)
	copy(cp, latencies)
	sort.Float64s(cp)

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

	return cp[p50Idx], cp[p95Idx], cp[p99Idx]
}

func round2(val float64) float64 {
	return math.Round(val*100) / 100
}
