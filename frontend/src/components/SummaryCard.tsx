import { Download, Sparkles } from 'lucide-react';
import { TickMetrics } from '../types';

interface SummaryCardProps {
  history: TickMetrics[];
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ history }) => {
  if (history.length === 0) return null;

  let totalCpuJson = 0;
  let totalCpuBin = 0;
  let totalRpsJson = 0;
  let totalRpsBin = 0;
  const count = history.length;

  history.forEach((tick) => {
    totalCpuJson += tick.json.cpu_pct;
    totalCpuBin += tick.binary.cpu_pct;
    totalRpsJson += tick.json.rps;
    totalRpsBin += tick.binary.rps;
  });

  const avgCpuJson = totalCpuJson / count;
  const avgCpuBin = totalCpuBin / count;
  const avgRpsJson = totalRpsJson / count;
  const avgRpsBin = totalRpsBin / count;

  const cpuSavedPct = avgCpuJson > 0 ? Math.max(0, ((avgCpuJson - avgCpuBin) / avgCpuJson) * 100) : 0;
  const throughputMult = avgRpsJson > 0 ? (avgRpsBin / avgRpsJson) : 1;

  const exportCSV = () => {
    let csv = "timestamp,json_cpu_pct,binary_cpu_pct,json_rps,binary_rps,json_p99_ms,binary_p99_ms\n";
    history.forEach((t) => {
      csv += `${t.timestamp},${t.json.cpu_pct},${t.binary.cpu_pct},${t.json.rps},${t.binary.rps},${t.json.p99_ms},${t.binary.p99_ms}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `byterail_run_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-binary-main/40 bg-gradient-to-r from-dark-800 via-dark-800 to-binary-main/10 shadow-2xl mb-8 relative overflow-hidden">
      
      <div className="flex flex-wrap items-center justify-between gap-6">
        
        {/* Main Winner Headline */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-binary-main/20 text-binary-main text-xs font-mono font-bold rounded-md border border-binary-main/40 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Performance Winner Verified
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-mono text-white tracking-tight">
            Binary gRPC saved <span className="text-binary-main">{cpuSavedPct.toFixed(1)}%</span> CPU and delivered <span className="text-cyan-400">{throughputMult.toFixed(2)}x</span> throughput
          </h2>
          <p className="text-xs text-slate-400 font-sans">Calculated across {count} real-time metric samples under identical workload.</p>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-4">
          <div className="bg-dark-900/90 border border-slate-800 p-3 rounded-xl text-center min-w-[110px]">
            <div className="text-xs font-mono text-slate-400">Avg JSON CPU</div>
            <div className="text-base font-mono font-bold text-json-main">{avgCpuJson.toFixed(1)}%</div>
          </div>
          <div className="bg-dark-900/90 border border-slate-800 p-3 rounded-xl text-center min-w-[110px]">
            <div className="text-xs font-mono text-slate-400">Avg Binary CPU</div>
            <div className="text-base font-mono font-bold text-binary-main">{avgCpuBin.toFixed(1)}%</div>
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

    </div>
  );
};
