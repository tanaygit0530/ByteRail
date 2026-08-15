import React from 'react';
import { Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TickMetrics } from '../types';

interface LatencyStatsProps {
  currentTick: TickMetrics | null;
}

export const LatencyStats: React.FC<LatencyStatsProps> = ({ currentTick }) => {
  const json = currentTick?.json || { p50_ms: 0, p95_ms: 0, p99_ms: 0 };
  const binary = currentTick?.binary || { p50_ms: 0, p95_ms: 0, p99_ms: 0 };

  const p99Diff = (json.p99_ms - binary.p99_ms).toFixed(1);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl mb-8">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold font-mono text-white">Sliding Window Latency Percentiles (Last 10s Window)</h3>
        </div>
        {json.p99_ms > 0 && (
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-md border border-cyan-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Binary p99 Tail Latency is {p99Diff}ms Faster
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* p50 Median Latency */}
        <div className="bg-dark-800/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-400 mb-2 font-medium">p50 Latency (Median)</div>
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-json-main font-semibold">JSON: {json.p50_ms.toFixed(1)} ms</span>
            <span className="text-binary-main font-semibold">Binary: {binary.p50_ms.toFixed(1)} ms</span>
          </div>
          <div className="w-full bg-dark-900 h-2 rounded-full mt-3 overflow-hidden flex">
            <div style={{ width: `${Math.min(100, json.p50_ms * 5)}%` }} className="bg-json-main h-full"></div>
            <div style={{ width: `${Math.min(100, binary.p50_ms * 5)}%` }} className="bg-binary-main h-full"></div>
          </div>
        </div>

        {/* p95 Percentile */}
        <div className="bg-dark-800/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-400 mb-2 font-medium">p95 Latency</div>
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-json-main font-semibold">JSON: {json.p95_ms.toFixed(1)} ms</span>
            <span className="text-binary-main font-semibold">Binary: {binary.p95_ms.toFixed(1)} ms</span>
          </div>
          <div className="w-full bg-dark-900 h-2 rounded-full mt-3 overflow-hidden flex">
            <div style={{ width: `${Math.min(100, json.p95_ms * 3)}%` }} className="bg-json-main h-full"></div>
            <div style={{ width: `${Math.min(100, binary.p95_ms * 3)}%` }} className="bg-binary-main h-full"></div>
          </div>
        </div>

        {/* p99 Tail Latency */}
        <div className="bg-dark-800/80 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="text-xs font-mono text-slate-400 mb-2 font-medium flex items-center justify-between">
            <span>p99 Tail Latency</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-rose-400 font-bold">JSON: {json.p99_ms.toFixed(1)} ms</span>
            <span className="text-binary-main font-bold">Binary: {binary.p99_ms.toFixed(1)} ms</span>
          </div>
          <div className="w-full bg-dark-900 h-2 rounded-full mt-3 overflow-hidden flex">
            <div style={{ width: `${Math.min(100, json.p99_ms * 2)}%` }} className="bg-rose-500 h-full"></div>
            <div style={{ width: `${Math.min(100, binary.p99_ms * 2)}%` }} className="bg-binary-main h-full"></div>
          </div>
        </div>

      </div>
    </div>
  );
};
