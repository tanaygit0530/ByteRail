export interface PathMetric {
  total_requests: number;
  rps: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  cpu_pct: number;
  bytes_total: number;
}

export interface TickMetrics {
  timestamp: number;
  active: boolean;
  json: PathMetric;
  binary: PathMetric;
}

export interface RoutingLogEntry {
  timestamp: string;
  header: string;
  mode: string;
  rationale: string;
}

export interface WebSocketMessage {
  type: string;
  tick: TickMetrics;
  routing_logs: RoutingLogEntry[];
  is_running: boolean;
}

export interface BenchmarkConfig {
  concurrency: number;
  payload_profile: 'tiny' | 'medium' | 'large';
  duration_sec: number;
  is_streaming: boolean;
  is_gzip: boolean;
}

export interface RunSummary {
  id: number;
  timestamp: string;
  concurrency: number;
  payload_profile: string;
  is_streaming: boolean;
  is_gzip: boolean;
  duration_sec: number;
  avg_cpu_json: number;
  avg_cpu_binary: number;
  avg_rps_json: number;
  avg_rps_binary: number;
  p99_json: number;
  p99_binary: number;
  cpu_saved_pct: number;
  throughput_multiplier: number;
}

export interface WaterfallData {
  json_raw: string;
  json_compact: string;
  json_bytes: number;
  proto_bytes: number;
  proto_hex: string;
  saved_pct: number;
  json_breakdown: {
    field_names: number;
    whitespace_punct: number;
    string_enc_numbers: number;
    actual_data_payload: number;
  };
  proto_breakdown: Record<string, string>;
}
