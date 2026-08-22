// src/hooks/useMissionControl.ts
import { useCallback, useEffect, useState } from "react";
import {
  fetchStatus,
  fetchModelStatus,
  fetchLatestState,
  fetchEvents,
  fetchDecisions,
  createMissionWebSocket,
  type SystemStatus,
  type ModelStatus,
  type LatestState,
  type LogEvent,
} from "@/lib/api";

export interface MissionSnapshot {
  wsConnected: boolean;
  status: SystemStatus | null;
  modelStatus: ModelStatus | null;
  latest: LatestState;
  events: LogEvent[];
  decisions: any[];
}

const EMPTY_LATEST: LatestState = {
  perception: null,
  cognition: null,
  action: null,
  consensus: null,
  escalation: null,
  status: null,
};

/**
 * One shared mission-control store for the whole app.
 *
 * The dashboard mounts this hook from a dozen places (every section, the
 * header, the side nav). Giving each caller its own poll loop and its own
 * WebSocket meant a dozen sockets and sixty HTTP requests every three seconds
 * against the same endpoints. The store below is module-level: the first
 * subscriber starts the poll and the socket, the last one to unmount tears
 * them down, and everyone reads the same snapshot.
 */
let snapshot: MissionSnapshot = {
  wsConnected: false,
  status: null,
  modelStatus: null,
  latest: EMPTY_LATEST,
  events: [],
  decisions: [],
};

const subscribers = new Set<(s: MissionSnapshot) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let wsCleanup: (() => void) | null = null;

function publish(patch: Partial<MissionSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const notify of subscribers) notify(snapshot);
}

const CHANNEL_TO_KEY: Record<string, keyof LatestState> = {
  "perception.out": "perception",
  "cognition.out": "cognition",
  "action.out": "action",
  "orchestrator.consensus": "consensus",
  "orchestrator.escalation": "escalation",
  "orchestrator.status": "status",
};

async function refreshAll() {
  try {
    const [s, m, l, ev, dec] = await Promise.all([
      fetchStatus().catch(() => null),
      fetchModelStatus().catch(() => null),
      fetchLatestState().catch(() => null),
      fetchEvents().catch(() => [] as LogEvent[]),
      fetchDecisions().catch(() => [] as any[]),
    ]);
    const patch: Partial<MissionSnapshot> = {};
    if (s) patch.status = s;
    if (m) patch.modelStatus = m;
    if (l) patch.latest = l;
    if (ev) patch.events = ev;
    if (dec) patch.decisions = dec;
    publish(patch);
  } catch (e) {
    console.warn("[MissionControl] Polling error", e);
  }
}

function startStream() {
  if (pollTimer) return;
  refreshAll();
  pollTimer = setInterval(refreshAll, 3000);

  wsCleanup = createMissionWebSocket((msg) => {
    if (!snapshot.wsConnected) publish({ wsConnected: true });

    if (msg.type === "initial_state") {
      const patch: Partial<MissionSnapshot> = {};
      if (msg.status) patch.status = { ...(snapshot.status ?? {}), ...msg.status } as SystemStatus;
      if (msg.latest) patch.latest = msg.latest;
      if (msg.event_log) patch.events = msg.event_log;
      publish(patch);
      return;
    }

    if (msg.type === "redis_message") {
      const key = CHANNEL_TO_KEY[msg.channel];
      if (key) publish({ latest: { ...snapshot.latest, [key]: msg.data } });
      return;
    }

    if (msg.type === "system_event") {
      // A committed override or an injected tripwire rewrites several agent
      // states at once — pull a fresh snapshot rather than patching piecemeal.
      refreshAll();
    }
  });
}

function stopStream() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  wsCleanup?.();
  wsCleanup = null;
  publish({ wsConnected: false });
}

export function useMissionControl() {
  const [state, setState] = useState<MissionSnapshot>(snapshot);

  useEffect(() => {
    const notify = (s: MissionSnapshot) => setState(s);
    subscribers.add(notify);
    startStream();
    setState(snapshot);

    return () => {
      subscribers.delete(notify);
      // Tear the stream down only when nothing is watching any more.
      if (subscribers.size === 0) stopStream();
    };
  }, []);

  const refresh = useCallback(() => refreshAll(), []);

  return {
    wsConnected: state.wsConnected,
    status: state.status,
    modelStatus: state.modelStatus,
    latest: state.latest,
    events: state.events,
    decisions: state.decisions,
    refreshAll: refresh,
  };
}
