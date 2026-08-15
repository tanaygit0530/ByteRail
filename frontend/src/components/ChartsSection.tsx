import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Cpu, Zap } from 'lucide-react';
import { TickMetrics } from '../types';

interface ChartsSectionProps {
  history: TickMetrics[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ history }) => {
  const chartData = history.map((tick) => ({
    time: new Date(tick.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
    jsonCpu: tick.json.cpu_pct,
    binaryCpu: tick.binary.cpu_pct,
    jsonRps: tick.json.rps,
    binaryRps: tick.binary.rps,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800/95 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs space-y-1 backdrop-blur-md">
          <p className="text-slate-400 font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span style={{ color: entry.color }} className="font-semibold">{entry.name}:</span>
              <span className="text-white font-bold">{entry.value} {entry.unit}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      
      {/* Chart A: CPU Utilization % */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-json-main" />
            <h3 className="text-sm font-bold font-mono text-white">CPU Utilization (%)</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-json-main font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-json-main"></span> JSON Path
            </span>
            <span className="flex items-center gap-1.5 text-binary-main font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-binary-main"></span> Binary Path
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorJsonCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorBinaryCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#161f36" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="jsonCpu" name="JSON CPU" unit="%" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorJsonCpu)" />
              <Area type="monotone" dataKey="binaryCpu" name="Binary CPU" unit="%" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorBinaryCpu)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart B: Throughput (RPS) */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-binary-main" />
            <h3 className="text-sm font-bold font-mono text-white">Throughput (Requests / sec)</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-json-main font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-json-main"></span> JSON Path
            </span>
            <span className="flex items-center gap-1.5 text-binary-main font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-binary-main"></span> Binary Path
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorJsonRps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorBinaryRps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#161f36" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="jsonRps" name="JSON RPS" unit=" req/s" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorJsonRps)" />
              <Area type="monotone" dataKey="binaryRps" name="Binary RPS" unit=" req/s" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorBinaryRps)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
