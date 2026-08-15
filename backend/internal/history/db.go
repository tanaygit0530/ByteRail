package history

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type RunSummary struct {
	ID                   int64     `json:"id"`
	Timestamp            time.Time `json:"timestamp"`
	Concurrency          int       `json:"concurrency"`
	PayloadProfile       string    `json:"payload_profile"`
	IsStreaming          bool      `json:"is_streaming"`
	IsGzip               bool      `json:"is_gzip"`
	DurationSec          int       `json:"duration_sec"`
	AvgCpuJSON           float64   `json:"avg_cpu_json"`
	AvgCpuBinary         float64   `json:"avg_cpu_binary"`
	AvgRpsJSON           float64   `json:"avg_rps_json"`
	AvgRpsBinary         float64   `json:"avg_rps_binary"`
	P99JSON              float64   `json:"p99_json"`
	P99Binary            float64   `json:"p99_binary"`
	CpuSavedPct          float64   `json:"cpu_saved_pct"`
	ThroughputMultiplier float64   `json:"throughput_multiplier"`
}

type Store struct {
	db *sql.DB
	mu sync.Mutex
}

func NewStore(dbPath string) (*Store, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite db: %w", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS benchmark_runs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		concurrency INTEGER,
		payload_profile TEXT,
		is_streaming BOOLEAN,
		is_gzip BOOLEAN,
		duration_sec INTEGER,
		avg_cpu_json REAL,
		avg_cpu_binary REAL,
		avg_rps_json REAL,
		avg_rps_binary REAL,
		p99_json REAL,
		p99_binary REAL,
		cpu_saved_pct REAL,
		throughput_multiplier REAL
	);`

	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	return &Store{db: db}, nil
}

func (s *Store) SaveRun(run RunSummary) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
	INSERT INTO benchmark_runs (
		timestamp, concurrency, payload_profile, is_streaming, is_gzip, duration_sec,
		avg_cpu_json, avg_cpu_binary, avg_rps_json, avg_rps_binary, p99_json, p99_binary,
		cpu_saved_pct, throughput_multiplier
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query,
		time.Now(), run.Concurrency, run.PayloadProfile, run.IsStreaming, run.IsGzip, run.DurationSec,
		run.AvgCpuJSON, run.AvgCpuBinary, run.AvgRpsJSON, run.AvgRpsBinary, run.P99JSON, run.P99Binary,
		run.CpuSavedPct, run.ThroughputMultiplier,
	)
	return err
}

func (s *Store) GetRecentRuns(limit int) ([]RunSummary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if limit <= 0 {
		limit = 20
	}

	query := `
	SELECT id, timestamp, concurrency, payload_profile, is_streaming, is_gzip, duration_sec,
	       avg_cpu_json, avg_cpu_binary, avg_rps_json, avg_rps_binary, p99_json, p99_binary,
	       cpu_saved_pct, throughput_multiplier
	FROM benchmark_runs
	ORDER BY id DESC
	LIMIT ?`

	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []RunSummary
	for rows.Next() {
		var r RunSummary
		var ts time.Time
		if err := rows.Scan(
			&r.ID, &ts, &r.Concurrency, &r.PayloadProfile, &r.IsStreaming, &r.IsGzip, &r.DurationSec,
			&r.AvgCpuJSON, &r.AvgCpuBinary, &r.AvgRpsJSON, &r.AvgRpsBinary, &r.P99JSON, &r.P99Binary,
			&r.CpuSavedPct, &r.ThroughputMultiplier,
		); err != nil {
			return nil, err
		}
		r.Timestamp = ts
		runs = append(runs, r)
	}

	return runs, nil
}
