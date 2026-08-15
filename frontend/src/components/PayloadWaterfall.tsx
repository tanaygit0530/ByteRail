import React, { useState, useEffect } from 'react';
import { Binary, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { WaterfallData } from '../types';

export const PayloadWaterfall: React.FC = () => {
  const [data, setData] = useState<WaterfallData | null>(null);

  useEffect(() => {
    fetch('http://localhost:8080/api/waterfall')
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((err) => console.error("Waterfall fetch error:", err));
  }, []);

  if (!data) return null;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-2xl mb-8">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
            <Binary className="w-5 h-5 text-binary-main" />
            Byte-by-Byte Payload Waterfall Breakdown
          </h2>
          <p className="text-xs text-slate-400">Canonical sample event payload comparison: JSON string overhead vs Protobuf wire format packing</p>
        </div>

        <div className="flex items-center gap-2 bg-binary-main/10 border border-binary-main/30 px-3 py-1.5 rounded-lg text-xs font-mono text-binary-main">
          <CheckCircle2 className="w-4 h-4" />
          <span>{data.saved_pct}% Payload Compression Saved</span>
        </div>
      </div>

      {/* Side by Side Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Left Panel: Raw JSON */}
        <div className="bg-dark-800/90 rounded-xl p-4 border border-json-main/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono text-json-main font-bold flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Raw JSON String Payload
            </span>
            <span className="text-xs font-mono bg-json-main/20 text-json-main px-2 py-0.5 rounded font-bold">
              {data.json_bytes} Bytes
            </span>
          </div>

          <pre className="bg-dark-900 p-3 rounded-lg text-xs font-mono text-amber-200 overflow-x-auto border border-slate-800 max-h-56 leading-relaxed">
            {data.json_raw}
          </pre>

          <div className="space-y-2 pt-2 border-t border-slate-800/60 text-xs font-mono">
            <div className="text-slate-400 font-semibold mb-1">Overhead Breakdown:</div>
            <div className="flex justify-between text-slate-300">
              <span>Key Names ("id", "timestamp", "user_id"):</span>
              <span className="text-json-main font-bold">{data.json_breakdown.field_names} bytes</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Quotes, Brackets, Colons & Whitespace:</span>
              <span className="text-json-main font-bold">{data.json_breakdown.whitespace_punct} bytes</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>String-encoded ASCII Numbers ("1723456..."):</span>
              <span className="text-json-main font-bold">{data.json_breakdown.string_enc_numbers} bytes</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Raw Values Data:</span>
              <span className="text-emerald-400 font-bold">{data.json_breakdown.actual_data_payload} bytes</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Protobuf Hex Dump */}
        <div className="bg-dark-800/90 rounded-xl p-4 border border-binary-main/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono text-binary-main font-bold flex items-center gap-1.5">
              <Binary className="w-4 h-4" /> Protobuf Binary Wire Format (Hex Dump)
            </span>
            <span className="text-xs font-mono bg-binary-main/20 text-binary-main px-2 py-0.5 rounded font-bold">
              {data.proto_bytes} Bytes
            </span>
          </div>

          <div className="bg-dark-900 p-3 rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto border border-slate-800 max-h-56 leading-relaxed flex flex-wrap gap-1.5">
            {data.proto_hex.match(/.{1,2}/g)?.map((byteHex: string, idx: number) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-dark-800 border border-emerald-500/20 rounded hover:border-emerald-400 text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                title={`Byte index ${idx}`}
              >
                {byteHex}
              </span>
            ))}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/60 text-xs font-mono text-slate-300">
            <div className="text-slate-400 font-semibold mb-1">Field Wire Encoding Annotations:</div>
            {Object.entries(data.proto_breakdown).map(([key, desc]: [string, string]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-binary-main mt-1.5 flex-shrink-0"></span>
                <span className="text-slate-300">{desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Size Comparison Bar */}
      <div className="bg-dark-800 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center space-x-4">
          <span className="text-slate-400">Total Payload Size:</span>
          <span className="text-json-main font-bold">JSON: {data.json_bytes} bytes</span>
          <ArrowRight className="w-4 h-4 text-slate-600" />
          <span className="text-binary-main font-bold">Binary: {data.proto_bytes} bytes</span>
        </div>
        <div className="text-cyan-400 font-bold bg-cyan-950/40 px-3 py-1 rounded-md border border-cyan-500/30">
          Protobuf Wire Format is {data.saved_pct}% Smaller (Zero Schema Key Overhead)
        </div>
      </div>

    </div>
  );
};
