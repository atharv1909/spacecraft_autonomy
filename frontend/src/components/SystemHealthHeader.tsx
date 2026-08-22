// src/components/SystemHealthHeader.tsx
import { useMissionControl } from "@/hooks/useMissionControl";
import { startOrchestrator, stopOrchestrator } from "@/lib/api";
import { useState } from "react";

export function SystemHealthHeader({ title = "SYMBIOSIS Mission Control" }: { title?: string }) {
  const { wsConnected, status, modelStatus, refreshAll } = useMissionControl();
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isModelOk = modelStatus?.loaded || status?.model_loaded || false;
  const isRedisOk = status?.redis_connected || false;
  const isWsOk = wsConnected;
  const isOrchOk = status?.orchestrator_running || false;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      showToast("Telemetry Refreshed");
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleToggleOrch = async () => {
    try {
      if (isOrchOk) {
        await stopOrchestrator();
        showToast("Orchestrator Paused");
      } else {
        await startOrchestrator();
        showToast("Orchestrator Started");
      }
      await refreshAll();
    } catch (e) {
      console.error(e);
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 h-16 z-30 bg-paper-surface/95 backdrop-blur-md border-b border-outline-variant/60 shrink-0 sticky top-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => scrollTo("section-hero")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
        >
          <span className="font-headline-md text-headline-md font-bold text-ink-charcoal tracking-tighter uppercase">
            {title}
          </span>
        </button>

        {toastMsg && (
          <span className="hidden md:inline-block text-[11px] font-mono font-bold bg-lacquer-red text-white px-2.5 py-0.5 rounded shadow-sm animate-pulse">
            {toastMsg}
          </span>
        )}
      </div>

      {/* Top Right Live Telemetry Connection Matrix */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 bg-surface-container-low/90 border border-outline-variant/60 rounded-lg px-3 py-1.5 shadow-sm">
          {/* WEBSOCKET Indicator */}
          <div 
            className="flex items-center gap-1.5 text-xs font-label-caps text-on-surface cursor-pointer select-none"
            onClick={handleManualRefresh}
            title="Real-time WebSocket event stream (Click to ping)"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isWsOk ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="hidden sm:inline font-bold">WS:</span>
            <span className={isWsOk ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
              {isWsOk ? "LIVE" : "DISC"}
            </span>
          </div>

          <div className="w-[1px] h-4 bg-outline-variant/60" />

          {/* REDIS Indicator */}
          <div 
            className="flex items-center gap-1.5 text-xs font-label-caps text-on-surface cursor-pointer select-none"
            onClick={handleManualRefresh}
            title="Redis Pub/Sub State Bus"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRedisOk ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-rose-500"
              }`}
            />
            <span className="hidden sm:inline font-bold">REDIS:</span>
            <span className={isRedisOk ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
              {isRedisOk ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>

          <div className="w-[1px] h-4 bg-outline-variant/60" />

          {/* MODEL Indicator */}
          <button 
            onClick={() => scrollTo("section-perception")}
            className="flex items-center gap-1.5 text-xs font-label-caps text-on-surface hover:opacity-80 transition-opacity select-none cursor-pointer"
            title="ResNet-50 Neural Inference Engine (Click to inspect Perception section)"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isModelOk ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-rose-500"
              }`}
            />
            <span className="hidden sm:inline font-bold">MODEL:</span>
            <span className={isModelOk ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
              {isModelOk ? "ONLINE" : "OFFLINE"}
            </span>
          </button>

          <div className="w-[1px] h-4 bg-outline-variant/60" />

          {/* ORCHESTRATOR Indicator */}
          <button 
            onClick={handleToggleOrch}
            className="flex items-center gap-1.5 text-xs font-label-caps text-on-surface hover:opacity-80 transition-opacity select-none cursor-pointer"
            title="Click to Start/Stop Autonomous Consensus Loop"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOrchOk ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="hidden sm:inline font-bold">ORCH:</span>
            <span className={isOrchOk ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
              {isOrchOk ? "RUNNING" : "IDLE"}
            </span>
          </button>
        </div>

        {/* Reload button with animation */}
        <button
          onClick={handleManualRefresh}
          className="text-on-surface-variant hover:text-lacquer-red transition-all p-2 rounded-lg bg-surface-container-low/90 border border-outline-variant/60 hover:border-lacquer-red/50 shadow-sm active:scale-95 cursor-pointer"
          title="Manual Telemetry & State Refresh"
        >
          <span className={`material-symbols-outlined text-[18px] block ${refreshing ? "animate-spin text-lacquer-red" : ""}`}>
            refresh
          </span>
        </button>
      </div>
    </header>
  );
}
