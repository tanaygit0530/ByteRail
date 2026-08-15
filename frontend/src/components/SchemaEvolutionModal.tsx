import React, { useState } from 'react';
import { X, FileCode2, Play, CheckCircle2 } from 'lucide-react';

interface SchemaEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchemaEvolutionModal: React.FC<SchemaEvolutionModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/schema-evolution');
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-3xl rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-dark-800 p-2 rounded-lg border border-slate-700"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <FileCode2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-white">Schema Evolution & Backwards Compatibility Demo</h2>
            <p className="text-xs text-slate-400">Prove old client integration remains intact after Protobuf field addition</p>
          </div>
        </div>

        {/* Diff Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-dark-800 p-4 rounded-xl border border-slate-800">
            <div className="text-slate-400 font-bold mb-2">Schema v1 (Old Client Definition):</div>
            <pre className="text-amber-200 bg-dark-900 p-3 rounded border border-slate-800 space-y-1">
{`message Event {
  string id = 1;
  int64 timestamp = 2;
  string user_id = 3;
  repeated Item items = 4;
  map<string, string> metadata = 5;
}`}
            </pre>
          </div>

          <div className="bg-dark-800 p-4 rounded-xl border border-emerald-500/30">
            <div className="text-emerald-400 font-bold mb-2">Schema v2 (Upgraded Service):</div>
            <pre className="text-emerald-200 bg-dark-900 p-3 rounded border border-slate-800 space-y-1">
{`message Event {
  string id = 1;
  int64 timestamp = 2;
  string user_id = 3;
  repeated Item items = 4;
  map<string, string> metadata = 5;
+ string discount_code = 6;
}`}
            </pre>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between bg-dark-800/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-300">
            Click to dispatch an old v1 request format (5 fields) against upgraded v2 backend service.
          </div>
          <button
            onClick={runTest}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-dark-950 font-mono text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            {loading ? 'Executing...' : 'Run Evolution Test'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/40 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Request Processed Successfully (Status: 200 OK)
            </div>
            <div className="text-slate-300">
              Response Status: <span className="text-white font-bold">{result.status}</span>
            </div>
            <p className="text-cyan-300 font-sans italic border-t border-emerald-500/20 pt-2">
              "{result.explanation}"
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
