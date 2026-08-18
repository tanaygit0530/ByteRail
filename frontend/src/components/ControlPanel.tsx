import { Play, Square, Users, Zap, Layers, FileCode2 } from 'lucide-react';
import { BenchmarkConfig } from '../types';

interface ControlPanelProps {
  config: BenchmarkConfig;
  onChange: (cfg: BenchmarkConfig) => void;
  onStart: () => void;
  onStop: () => void;
  onOpenSchemaDemo: () => void;
  isRunning: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onChange,
  onStart,
  onStop,
  onOpenSchemaDemo,
  isRunning
}) => {
  const concurrencyPreset = [1, 50, 200, 500];

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-2xl mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-binary-main" />
            Benchmark Workload Controller
          </h2>
          <p className="text-xs text-slate-400">Configure synthetic load parameters fired sequentially in comparable benchmark phases</p>
        </div>

        <button
          onClick={onOpenSchemaDemo}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-mono text-xs font-semibold rounded-lg border border-cyan-500/30 transition-all shadow-md shadow-cyan-950/40"
        >
          <FileCode2 className="w-4 h-4 text-cyan-400" />
          Demo: Schema Evolution
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
        
        {/* Concurrency Level */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <Users className="w-4 h-4 text-binary-main" />
              Concurrent Clients: <span className="text-binary-main font-bold text-sm">{config.concurrency}</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            {concurrencyPreset.map((val) => (
              <button
                key={val}
                disabled={isRunning}
                onClick={() => onChange({ ...config, concurrency: val })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                  config.concurrency === val
                    ? 'bg-binary-main text-dark-900 border-binary-main shadow-lg shadow-binary-main/20'
                    : 'bg-dark-800 text-slate-400 border-slate-700 hover:border-slate-500'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="500"
            disabled={isRunning}
            value={config.concurrency}
            onChange={(e) => onChange({ ...config, concurrency: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-binary-main"
          />
        </div>

        {/* Payload Profile */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-300 font-medium flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-json-main" />
            Payload Size Profile
          </label>
          <select
            disabled={isRunning}
            value={config.payload_profile}
            onChange={(e) => onChange({ ...config, payload_profile: e.target.value as any })}
            className="w-full bg-dark-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-binary-main"
          >
            <option value="tiny">Tiny (1 event / ~110B)</option>
            <option value="medium">Medium (10 events / ~1.2KB)</option>
            <option value="large">Large (200 events / ~24KB)</option>
          </select>
        </div>

        {/* Toggles (Streaming & Gzip) */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-300 font-medium">Protocol Options</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center space-x-2 text-xs font-mono text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                disabled={isRunning}
                checked={config.is_streaming}
                onChange={(e) => onChange({ ...config, is_streaming: e.target.checked })}
                className="rounded bg-dark-800 border-slate-700 text-binary-main focus:ring-0"
              />
              <span>gRPC Stream Mode</span>
            </label>
            <label className="flex items-center space-x-2 text-xs font-mono text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                disabled={isRunning}
                checked={config.is_gzip}
                onChange={(e) => onChange({ ...config, is_gzip: e.target.checked })}
                className="rounded bg-dark-800 border-slate-700 text-json-main focus:ring-0"
              />
              <span>Compress JSON (gzip)</span>
            </label>
          </div>
        </div>

        {/* Start / Stop Button */}
        <div>
          {!isRunning ? (
            <button
              onClick={onStart}
              className="w-full py-3 bg-gradient-to-r from-binary-main to-emerald-500 hover:from-emerald-400 hover:to-binary-main text-dark-900 font-mono font-bold text-sm rounded-xl shadow-lg shadow-binary-main/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Play className="w-5 h-5 fill-current" />
              START BENCHMARK
            </button>
          ) : (
            <button
              onClick={onStop}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-sm rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              STOP BENCHMARK
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
