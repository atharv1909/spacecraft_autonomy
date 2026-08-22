// src/hooks/useMissionControl.ts
import { useState, useEffect, useCallback } from "react";
import {
  fetchStatus,
  fetchModelStatus,
  fetchLatestState,
  fetchEvents,
  fetchDecisions,
  createMissionWebSocket,
  SystemStatus,
  ModelStatus,
  LatestState,
  LogEvent,
} from "@/lib/api";

export function useMissionControl() {
  const [wsConnected, setWsConnected] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [latest, setLatest] = useState<LatestState>({
    perception: null,
    cognition: null,
    action: null,
    consensus: null,
    escalation: null,
    status: null,
  });
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);

  const refreshAll = useCallback(async () => {
    try {
      const [s, m, l, ev, dec] = await Promise.all([
        fetchStatus().catch(() => null),
        fetchModelStatus().catch(() => null),
        fetchLatestState().catch(() => null),
        fetchEvents().catch(() => []),
        fetchDecisions().catch(() => []),
      ]);
      if (s) setStatus(s);
      if (m) setModelStatus(m);
      if (l) setLatest(l);
      if (ev) setEvents(ev);
      if (dec) setDecisions(dec);
    } catch (e) {
      console.warn("[MissionControl] Polling error", e);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 3000);

    const cleanupWs = createMissionWebSocket((msg) => {
      setWsConnected(true);
      if (msg.type === "initial_state") {
        if (msg.status) setStatus((prev) => ({ ...prev, ...msg.status }));
        if (msg.latest) setLatest(msg.latest);
        if (msg.event_log) setEvents(msg.event_log);
      } else if (msg.type === "redis_message") {
        const channel = msg.channel;
        const data = msg.data;
        setLatest((prev) => {
          const map: Record<string, keyof LatestState> = {
            "perception.out": "perception",
            "cognition.out": "cognition",
            "action.out": "action",
            "orchestrator.consensus": "consensus",
            "orchestrator.escalation": "escalation",
            "orchestrator.status": "status",
          };
          const key = map[channel];
          if (key) {
            return { ...prev, [key]: data };
          }
          return prev;
        });
      }
    });

    return () => {
      clearInterval(interval);
      cleanupWs();
    };
  }, [refreshAll]);

  return {
    wsConnected,
    status,
    modelStatus,
    latest,
    events,
    decisions,
    refreshAll,
  };
}
