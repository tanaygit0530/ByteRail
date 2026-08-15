import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { ChartsSection } from './components/ChartsSection';
import { SummaryCard } from './components/SummaryCard';
import { LatencyStats } from './components/LatencyStats';
import { PayloadWaterfall } from './components/PayloadWaterfall';
import { RoutingLog } from './components/RoutingLog';
import { SchemaEvolutionModal } from './components/SchemaEvolutionModal';
import { CompressionTradeoff } from './components/CompressionTradeoff';
import { RunHistory } from './components/RunHistory';

import { WebSocketClient } from './services/websocket';
import { TickMetrics, RoutingLogEntry, BenchmarkConfig, WebSocketMessage } from './types';

export const App: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<TickMetrics[]>([]);
  const [currentTick, setCurrentTick] = useState<TickMetrics | null>(null);
  const [routingLogs, setRoutingLogs] = useState<RoutingLogEntry[]>([]);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  const [config, setConfig] = useState<BenchmarkConfig>({
    concurrency: 50,
    payload_profile: 'medium',
    duration_sec: 30,
    is_streaming: false,
    is_gzip: false,
  });

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    if (msg.type === 'metrics_tick') {
      setCurrentTick(msg.tick);
      setIsRunning(msg.is_running);
      setRoutingLogs(msg.routing_logs || []);

      setMetricsHistory((prev) => {
        const next = [...prev, msg.tick];
        if (next.length > 120) {
          return next.slice(next.length - 120);
        }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8080/ws`;
    const client = new WebSocketClient(wsUrl, handleMessage, setConnected);
    client.connect();
    return () => client.disconnect();
  }, [handleMessage]);

  const handleStartBenchmark = async () => {
    setMetricsHistory([]);
    try {
      await fetch('http://localhost:8080/api/benchmark/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setIsRunning(true);
    } catch (e) {
      console.error('Failed to start benchmark', e);
    }
  };

  const handleStopBenchmark = async () => {
    try {
      await fetch('http://localhost:8080/api/benchmark/stop', {
        method: 'POST',
      });
      setIsRunning(false);
    } catch (e) {
      console.error('Failed to stop benchmark', e);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 font-sans pb-16">
      
      {/* Header Bar */}
      <Header connected={connected} isRunning={isRunning} />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6">
        
        {/* Workload Control Panel */}
        <ControlPanel
          config={config}
          onChange={setConfig}
          onStart={handleStartBenchmark}
          onStop={handleStopBenchmark}
          onOpenSchemaDemo={() => setIsSchemaModalOpen(true)}
          isRunning={isRunning}
        />

        {/* Compression Tradeoff Banner */}
        <CompressionTradeoff isGzipEnabled={config.is_gzip} />

        {/* Live Synchronized Charts (CPU & RPS) */}
        <ChartsSection history={metricsHistory} />

        {/* End-of-Run Summary Card */}
        <SummaryCard history={metricsHistory} />

        {/* Latency Percentiles */}
        <LatencyStats currentTick={currentTick} />

        {/* Hero Visual 1: Payload Waterfall */}
        <PayloadWaterfall />

        {/* Hero Visual 2: Routing Log */}
        <RoutingLog logs={routingLogs} />

        {/* SQLite Run History */}
        <RunHistory />

      </main>

      {/* Schema Evolution Modal */}
      <SchemaEvolutionModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
      />

    </div>
  );
};

export default App;
