import { Activity } from 'lucide-react';

interface HeaderProps {
  connected: boolean;
  isRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({ connected, isRunning }) => {
  return (
    <header className="glass-panel sticky top-0 z-50 border-b border-slate-800 bg-dark-900/90 backdrop-blur-md px-6 py-4 mb-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Logo & Title */}
        <div className="flex items-center space-x-4">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-binary-main to-emerald-400 text-dark-900 shadow-lg shadow-binary-main/20 font-mono font-black text-xl tracking-tighter">
            BR
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-mono">ByteRail</h1>
              <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-binary-main/10 text-binary-main border border-binary-main/30">
                Zero-Copy gRPC Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400">JSON REST Baseline vs. Binary Protobuf gRPC Real-Time Benchmark</p>
          </div>
        </div>

        {/* Path Legend */}
        <div className="flex items-center space-x-6 text-xs font-mono bg-dark-800/80 px-4 py-2 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-json-main shadow-[0_0_8px_#f59e0b]"></span>
            <span className="text-slate-300 font-medium">JSON REST Path</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-binary-main shadow-[0_0_8px_#10b981]"></span>
            <span className="text-slate-300 font-medium">Protobuf gRPC Path</span>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2 text-xs font-mono bg-dark-800 px-3 py-1.5 rounded-md border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className={connected ? 'text-slate-300' : 'text-rose-400'}>
              {connected ? 'WebSocket Connected' : 'Reconnecting...'}
            </span>
          </div>

          {/* Engine Status */}
          <div className={`flex items-center space-x-2 text-xs font-mono px-3.5 py-1.5 rounded-md border font-semibold ${
            isRunning 
              ? 'bg-binary-main/20 text-binary-main border-binary-main/40 animate-pulse' 
              : 'bg-dark-800 text-slate-400 border-slate-800'
          }`}>
            <Activity className="w-4 h-4" />
            <span>{isRunning ? 'BENCHMARK RUNNING' : 'SYSTEM IDLE'}</span>
          </div>
        </div>

      </div>
    </header>
  );
};
