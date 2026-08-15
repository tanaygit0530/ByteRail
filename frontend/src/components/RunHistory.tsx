import React, { useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { RunSummary } from '../types';

export const RunHistory: React.FC = () => {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/history');
      const data = await res.json();
      setRuns(data || []);
    } catch (e) {
      console.error("Failed to fetch run history", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold font-mono text-white">Benchmark Run History (SQLite Storage)</h3>
        </div>
        <button
          onClick={fetchHistory}
          className="p-2 text-slate-400 hover:text-white bg-dark-800 rounded-lg border border-slate-700 transition-colors"
          title="Refresh History"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-3 font-semibold">ID</th>
              <th className="pb-3 font-semibold">Timestamp</th>
              <th className="pb-3 font-semibold">Workload</th>
              <th className="pb-3 font-semibold">Mode</th>
              <th className="pb-3 font-semibold text-right">JSON CPU</th>
              <th className="pb-3 font-semibold text-right">Binary CPU</th>
              <th className="pb-3 font-semibold text-right">JSON RPS</th>
              <th className="pb-3 font-semibold text-right">Binary RPS</th>
              <th className="pb-3 font-semibold text-right">CPU Saved %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-600 italic">
                  No historical benchmark runs recorded yet. Run a benchmark to populate SQLite history.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="hover:bg-dark-800/40 transition-colors">
                  <td className="py-3 text-slate-400">#{r.id}</td>
                  <td className="py-3 text-slate-300">
                    {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 text-slate-200">
                    {r.concurrency} clients / {r.payload_profile}
                  </td>
                  <td className="py-3 text-slate-400">
                    {r.is_streaming ? 'gRPC Stream' : r.is_gzip ? 'JSON gzip' : 'Unary'}
                  </td>
                  <td className="py-3 text-right text-json-main font-bold">{r.avg_cpu_json}%</td>
                  <td className="py-3 text-right text-binary-main font-bold">{r.avg_cpu_binary}%</td>
                  <td className="py-3 text-right text-slate-300">{r.avg_rps_json}</td>
                  <td className="py-3 text-right text-cyan-400 font-bold">{r.avg_rps_binary}</td>
                  <td className="py-3 text-right text-binary-main font-bold bg-binary-main/10 rounded px-2">
                    +{r.cpu_saved_pct}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
