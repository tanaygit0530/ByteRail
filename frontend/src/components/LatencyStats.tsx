import React from 'react';
import { Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TickMetrics } from '../types';

interface LatencyStatsProps {
  currentTick: TickMetrics | null;
}

export const LatencyStats: React.FC<LatencyStatsProps> = ({ currentTick }) => {
  const json = currentTick?.json || { p50_ms: 0, p95_ms: 0, p99_ms: 0, sample_count: 0 };
  const binary = currentTick?.binary || { p50_ms: 0, p95_ms: 0, p99_ms: 0, sample_count: 0 };

  const hasJsonSamples = json.p50_ms > 0 || (json.sample_count || 0) > 0;
  const hasBinarySamples = binary.p50_ms > 0 || (binary.sample_count || 0) > 0;
  const hasBothSamples = hasJsonSamples && hasBinarySamples;

  const p99Diff = binary.p99_ms - json.p99_ms;
  const p99Abs = Math.abs(p99Diff).toFixed(1);

  let p99BadgeText = "";
  let isFaster = false;

  if (hasBothSamples) {
    if (p99Diff < -0.05) {
      p99BadgeText = `Binary p99 Tail Latency is ${p99Abs}ms Faster`;
      isFaster = true;
    } else if (p99Diff > 0.05) {
      p99BadgeText = `Binary p99 Tail Latency is ${p99Abs}ms Slower`;
      isFaster = false;
    } else {
      p99BadgeText = `Binary & JSON p99 Latency Equal (${binary.p99_ms.toFixed(1)}ms)`;
      isFaster = true;
    }
  }

  const renderVal = (val: number, hasSamples: boolean) => {
    if (!hasSamples || val === 0) {
      return <span className="text-slate-500 italic text-xs">Waiting for samples</span>;
    }
    return <span>{val.toFixed(1)} ms</span>;
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl mb-8">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold font-mono text-white">Sliding Window Latency Percentiles (60s Rolling Window)</h3>
        </div>
        {p99BadgeText ? (
          <span className={`text-xs font-mono px-3 py-1 rounded-md border flex items-center gap-1.5 ${
            isFaster ? 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30' : 'text-amber-400 bg-amber-950/40 border-amber-500/30'
          }`}>
            {isFaster ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {p99BadgeText}
          </span>
        ) : (
          <span className="text-xs font-mono text-slate-500 bg-dark-800 px-3 py-1 rounded-md border border-slate-800">
            Sampling active requests...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* p50 Median Latency */}
        <div className="bg-dark-800/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-400 mb-2 font-medium">p50 Latency (Median)</div>
          <div className="flex items-center justify-between text-sm font-mono">
            <span className="text-json-main font-semibold">JSON: {renderVal(json.p50_ms, hasJsonSamples)}</span>
            <span className="text-binary-main font-semibold">Binary: {renderVal(binary.p50_ms, hasBinarySamples)}</span>
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
            <span className="text-json-main font-semibold">JSON: {renderVal(json.p95_ms, hasJsonSamples)}</span>
            <span className="text-binary-main font-semibold">Binary: {renderVal(binary.p95_ms, hasBinarySamples)}</span>
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
            <span className="text-rose-400 font-bold">JSON: {renderVal(json.p99_ms, hasJsonSamples)}</span>
            <span className="text-binary-main font-bold">Binary: {renderVal(binary.p99_ms, hasBinarySamples)}</span>
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
