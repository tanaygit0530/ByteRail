import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { RoutingLogEntry } from '../types';

interface RoutingLogProps {
  logs: RoutingLogEntry[];
}

export const RoutingLog: React.FC<RoutingLogProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-2xl mb-8">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-binary-main" />
          <h3 className="text-sm font-bold font-mono text-white">Automatic Mode Switcher — Real-Time Routing Log</h3>
        </div>
        <span className="text-xs font-mono text-slate-400">Inspecting incoming Accept / X-ByteRail-Mode headers</span>
      </div>

      <div
        ref={containerRef}
        className="bg-dark-950 p-4 rounded-xl font-mono text-xs max-h-60 overflow-y-auto space-y-2 border border-slate-800 shadow-inner"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">
            No routing decisions recorded yet. Start a benchmark or trigger endpoints.
          </div>
        ) : (
          logs.map((entry, idx) => (
            <div key={idx} className="flex items-start space-x-3 py-1 border-b border-slate-800/40 last:border-0 hover:bg-dark-800/40 px-2 rounded transition-colors">
              <span className="text-slate-500 font-medium shrink-0">[{entry.timestamp}]</span>
              <span className="text-slate-400 shrink-0 font-semibold">Header: "{entry.header}"</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                entry.mode.includes('BINARY')
                  ? 'bg-binary-main/20 text-binary-main border border-binary-main/40'
                  : entry.mode.includes('JSON')
                  ? 'bg-json-main/20 text-json-main border border-json-main/40'
                  : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
              }`}>
                {entry.mode}
              </span>
              <span className="text-slate-300 font-sans truncate">{entry.rationale}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
