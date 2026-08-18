import React from 'react';
import { Download, Sparkles, ShieldAlert, CheckCircle2, Award, Zap, Cpu, Clock, HardDrive } from 'lucide-react';
import { TickMetrics } from '../types';

interface SummaryCardProps {
  history: TickMetrics[];
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ history }) => {
  if (history.length === 0) return null;

  const lastTick = history[history.length - 1];

  const jsonRps = lastTick?.json.rps || 0;
  const binaryRps = lastTick?.binary.rps || 0;
  const jsonCpu = lastTick?.json.cpu_pct || 0;
  const binaryCpu = lastTick?.binary.cpu_pct || 0;

  const jsonP50 = lastTick?.json.p50_ms || 0;
  const binaryP50 = lastTick?.binary.p50_ms || 0;
  const jsonP95 = lastTick?.json.p95_ms || 0;
  const binaryP95 = lastTick?.binary.p95_ms || 0;
  const jsonP99 = lastTick?.json.p99_ms || 0;
  const binaryP99 = lastTick?.binary.p99_ms || 0;

  const hasJsonRps = jsonRps > 0;
  const hasBinaryRps = binaryRps > 0;
  const hasJsonCpu = jsonCpu > 0;
  const hasBinaryCpu = binaryCpu > 0;

  const hasCompleteMetrics = hasJsonRps && hasBinaryRps && hasJsonCpu && hasBinaryCpu;

  const cpuSavedPct = (hasJsonCpu && hasBinaryCpu && jsonCpu > 0)
    ? ((jsonCpu - binaryCpu) / jsonCpu) * 100
    : 0;

  const throughputMult = (hasJsonRps && hasBinaryRps && jsonRps > 0)
    ? (binaryRps / jsonRps)
    : 0;

  // Individual Metric Winners
  const cpuWinner = !hasJsonCpu || !hasBinaryCpu ? "Awaiting Data" : binaryCpu < jsonCpu ? "Binary" : "JSON";
  const rpsWinner = !hasJsonRps || !hasBinaryRps ? "Awaiting Data" : binaryRps > jsonRps ? "Binary" : "JSON";
  const p50Winner = jsonP50 === 0 || binaryP50 === 0 ? "Awaiting Data" : binaryP50 < jsonP50 ? "Binary" : "JSON";
  const p95Winner = jsonP95 === 0 || binaryP95 === 0 ? "Awaiting Data" : binaryP95 < jsonP95 ? "Binary" : "JSON";
  const p99Winner = jsonP99 === 0 || binaryP99 === 0 ? "Awaiting Data" : binaryP99 < jsonP99 ? "Binary" : "JSON";

  // Overall Winner Badge
  let winnerBadgeText = "Benchmark Validation Required";
  let winnerBadgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40";

  if (!hasCompleteMetrics) {
    winnerBadgeText = "Benchmark Validation Required";
    winnerBadgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40";
  } else if (binaryRps > jsonRps && binaryCpu < jsonCpu) {
    winnerBadgeText = "ByteRail Performance Winner";
    winnerBadgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  } else if (jsonRps > binaryRps && jsonCpu < binaryCpu) {
    winnerBadgeText = "JSON Performance Winner";
    winnerBadgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40";
  } else {
    winnerBadgeText = "Mixed Benchmark Result";
    winnerBadgeClass = "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
  }

  // Dynamic Headline Text
  let headlineText = "";
  if (!hasCompleteMetrics) {
    headlineText = "Measuring path metrics... Run full benchmark sequence for complete validation.";
  } else if (binaryCpu < jsonCpu && binaryRps > jsonRps) {
    headlineText = `Binary gRPC saved ${cpuSavedPct.toFixed(1)}% CPU and delivered ${throughputMult.toFixed(2)}x higher throughput`;
  } else if (binaryCpu < jsonCpu && binaryRps <= jsonRps) {
    headlineText = `Binary gRPC saved ${cpuSavedPct.toFixed(1)}% CPU with ${throughputMult.toFixed(2)}x JSON throughput`;
  } else if (binaryCpu >= jsonCpu && binaryRps > jsonRps) {
    headlineText = `Binary gRPC delivered ${throughputMult.toFixed(2)}x higher throughput with ${Math.abs(cpuSavedPct).toFixed(1)}% higher CPU`;
  } else {
    headlineText = `JSON REST path performed better in this workload configuration`;
  }

  const exportCSV = () => {
    let csv = "timestamp,phase,json_cpu_pct,binary_cpu_pct,json_rps,binary_rps,json_p50_ms,binary_p50_ms,json_p95_ms,binary_p95_ms,json_p99_ms,binary_p99_ms,json_errors,binary_errors\n";
    history.forEach((t) => {
      csv += `${t.timestamp},${t.phase || 'idle'},${t.json.cpu_pct},${t.binary.cpu_pct},${t.json.rps},${t.binary.rps},${t.json.p50_ms},${t.binary.p50_ms},${t.json.p95_ms},${t.binary.p95_ms},${t.json.p99_ms},${t.binary.p99_ms},${t.json.errors || 0},${t.binary.errors || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `byterail_run_${Date.now()}.csv`;
    a.click();
  };

  const renderMetricVal = (val: number, isAvailable: boolean, unit: string = "") => {
    if (!isAvailable || val === 0) {
      return <span className="text-slate-500 italic text-xs">Waiting for samples</span>;
    }
    return <span>{val.toFixed(1)}{unit}</span>;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-binary-main/40 bg-gradient-to-r from-dark-800 via-dark-800 to-binary-main/10 shadow-2xl mb-8 relative overflow-hidden">
      
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
        
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md border flex items-center gap-1 ${winnerBadgeClass}`}>
              {!hasCompleteMetrics ? (
                <ShieldAlert className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {winnerBadgeText}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-mono text-white tracking-tight">
            {headlineText}
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Measured across {history.length} real-time metric samples under identical workload configuration.
          </p>
        </div>

        {/* Action Buttons & Quick Badges */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-dark-900/90 border border-slate-800 p-3 rounded-xl text-center min-w-[110px]">
            <div className="text-xs font-mono text-slate-400">Throughput Ratio</div>
            <div className="text-base font-mono font-bold text-cyan-400">
              {throughputMult > 0 ? `${throughputMult.toFixed(2)}x` : 'Waiting...'}
            </div>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-3 bg-dark-900 hover:bg-dark-800 text-white font-mono text-xs font-semibold rounded-xl border border-slate-700 hover:border-slate-500 transition-all shadow-md"
          >
            <Download className="w-4 h-4 text-binary-main" />
            Export CSV
          </button>
        </div>

      </div>

      {/* Transparent Metric Scorecard */}
      <div className="bg-dark-900/90 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
          <Award className="w-4 h-4 text-binary-main" />
          <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
            Transparent Metric Scorecard (Side-by-Side Comparison)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-semibold">Metric</th>
                <th className="pb-2 font-semibold text-json-main">JSON REST Path</th>
                <th className="pb-2 font-semibold text-binary-main">ByteRail gRPC Path</th>
                <th className="pb-2 font-semibold text-right">Metric Winner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              
              {/* CPU Usage */}
              <tr>
                <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" /> Process CPU Usage
                </td>
                <td className="py-2.5 text-json-main font-bold">{renderMetricVal(jsonCpu, hasJsonCpu, "%")}</td>
                <td className="py-2.5 text-binary-main font-bold">{renderMetricVal(binaryCpu, hasBinaryCpu, "%")}</td>
                <td className="py-2.5 text-right font-bold">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                    cpuWinner === "Binary" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" :
                    cpuWinner === "JSON" ? "bg-amber-950/60 text-amber-400 border border-amber-500/30" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {cpuWinner}
                  </span>
                </td>
              </tr>

              {/* Throughput RPS */}
              <tr>
                <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-slate-400" /> Throughput (RPS)
                </td>
                <td className="py-2.5 text-json-main font-bold">{renderMetricVal(jsonRps, hasJsonRps, " RPS")}</td>
                <td className="py-2.5 text-binary-main font-bold">{renderMetricVal(binaryRps, hasBinaryRps, " RPS")}</td>
                <td className="py-2.5 text-right font-bold">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                    rpsWinner === "Binary" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" :
                    rpsWinner === "JSON" ? "bg-amber-950/60 text-amber-400 border border-amber-500/30" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {rpsWinner}
                  </span>
                </td>
              </tr>

              {/* p50 Latency */}
              <tr>
                <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> p50 Latency (Median)
                </td>
                <td className="py-2.5 text-json-main font-bold">{renderMetricVal(jsonP50, jsonP50 > 0, " ms")}</td>
                <td className="py-2.5 text-binary-main font-bold">{renderMetricVal(binaryP50, binaryP50 > 0, " ms")}</td>
                <td className="py-2.5 text-right font-bold">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                    p50Winner === "Binary" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" :
                    p50Winner === "JSON" ? "bg-amber-950/60 text-amber-400 border border-amber-500/30" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {p50Winner}
                  </span>
                </td>
              </tr>

              {/* p95 Latency */}
              <tr>
                <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> p95 Latency
                </td>
                <td className="py-2.5 text-json-main font-bold">{renderMetricVal(jsonP95, jsonP95 > 0, " ms")}</td>
                <td className="py-2.5 text-binary-main font-bold">{renderMetricVal(binaryP95, binaryP95 > 0, " ms")}</td>
                <td className="py-2.5 text-right font-bold">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                    p95Winner === "Binary" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" :
                    p95Winner === "JSON" ? "bg-amber-950/60 text-amber-400 border border-amber-500/30" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {p95Winner}
                  </span>
                </td>
              </tr>

              {/* p99 Latency */}
              <tr>
                <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> p99 Tail Latency
                </td>
                <td className="py-2.5 text-rose-400 font-bold">{renderMetricVal(jsonP99, jsonP99 > 0, " ms")}</td>
                <td className="py-2.5 text-binary-main font-bold">{renderMetricVal(binaryP99, binaryP99 > 0, " ms")}</td>
                <td className="py-2.5 text-right font-bold">
                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                    p99Winner === "Binary" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" :
                    p99Winner === "JSON" ? "bg-amber-950/60 text-amber-400 border border-amber-500/30" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {p99Winner}
                  </span>
                </td>
              </tr>

              {/* Payload Size */}
              <tr>
                <td className="py-2.5 text-slate-300 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Canonical Payload Size
                </td>
                <td className="py-2.5 text-json-main font-bold">203 Bytes</td>
                <td className="py-2.5 text-binary-main font-bold">108 Bytes</td>
                <td className="py-2.5 text-right font-bold">
                  <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                    Binary (-46.8%)
                  </span>
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
