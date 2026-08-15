import { Info } from 'lucide-react';

interface CompressionTradeoffProps {
  isGzipEnabled: boolean;
}

export const CompressionTradeoff: React.FC<CompressionTradeoffProps> = ({ isGzipEnabled }) => {
  if (!isGzipEnabled) return null;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-json-main/40 bg-gradient-to-r from-dark-800 to-amber-950/20 shadow-xl mb-8">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-json-main/20 text-json-main">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs font-mono">
          <h4 className="font-bold text-json-main text-sm">Gzip Compression Trade-off Active</h4>
          <p className="text-slate-300 font-sans leading-relaxed">
            <strong className="text-amber-200">JSON (gzip):</strong> Reduces payload size by ~38%, but adds <strong className="text-rose-400">+15% CPU overhead</strong> due to compression algorithms.
            <br />
            <strong className="text-binary-main">Binary (Protobuf):</strong> Achieves <strong className="text-binary-main">63% smaller payloads</strong> with <strong className="text-binary-main">LOWER CPU usage</strong> than raw JSON, eliminating the bandwidth-vs-CPU dilemma entirely.
          </p>
        </div>
      </div>
    </div>
  );
};
