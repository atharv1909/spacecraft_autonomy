// src/lib/api.ts
import { API_BASE, WS_URL as WS_BASE } from "./endpoints";
// Real API & WebSocket Client for SYMBIOSIS Mission Control

export interface SystemStatus {
  redis_connected: boolean;
  orchestrator_running: boolean;
  scenario_running: boolean;
  current_scenario: string | null;
  model_loaded: boolean;
  modules: Record<string, boolean>;
  has_data: Record<string, boolean>;
  event_count: number;
  decision_count: number;
}

export interface ModelStatus {
  loaded: boolean;
  info: {
    backbone?: string;
    epoch?: number | string;
    rot_err_deg?: number;
    trans_err_m?: number;
    file_size_mb?: number;
    params?: number;
  };
  perception_available: boolean;
}

export interface PerceptionData {
  agent_id: string;
  message_type: string;
  source?: string;
  timestamp: number;
  R: number[][];
  t: number[];
  quaternion: number[];
  jensen_gain: number;
  confidence_level: string;
  confidence_label: string;
  sigma_R_deg: number;
  sigma_t_m: number;
  nearest_anchor_idx: number;
  anchor_distance_deg: number;
  is_trustworthy: boolean;
  physics_residual_m: number;
  physics_consistent: boolean;
  ood_distance: number;
  is_in_distribution: boolean;
  cross_estimator_agreement: boolean | null;
  rotation_disagreement_deg: number;
  calibrated_error_bound_deg: number;
  calibration_coverage: number;
  processing_time_ms: number;
  image_shape: number[];
}

export interface CognitionData {
  agent_id: string;
  message_type: string;
  timestamp: string;
  situation_id?: string;
  anomaly_detected?: boolean;
  anomaly_type?: string;
  anomaly_severity?: string;
  novelty_score?: number;
  recommended_action?: string;
  action_confidence?: number;
  explanation?: string;
  root_cause?: string;
  root_cause_narrative?: string;
  subsystem_states?: Record<string, string>;
  component_breakdown?: Record<string, number>;
  payload?: {
    is_novel?: boolean;
    max_similarity?: number;
    recommended_action?: string;
    root_cause?: string;
    root_cause_narrative?: string;
    subsystem_states?: Record<string, string>;
    explanation?: {
      narrative?: string;
      component_breakdown?: Record<string, number>;
      similarity_heatmap?: Array<{
        case_id: number;
        similarity_pct: number;
        outcome: string;
        success_rate: number;
        action: string;
      }>;
    };
  };
}

export interface ActionData {
  agent_id: string;
  message_type: string;
  primary_action: string;
  primary_score: number;
  collision_prob: number;
  collision_prob_upper_bound_99: number;
  alternatives: Array<{
    action: string;
    score: number;
    collision_prob?: number;
    collision_prob_upper_bound_99?: number;
  }>;
  explanation: string;
}

export interface ConsensusData {
  agent_id: string;
  message_type: string;
  final_action: string;
  consensus_reached: boolean;
  votes: Record<string, string>;
  override_applied: boolean;
  override_level: string;
  escalated_to_human: boolean;
  reasoning: string;
  fallback_triggered: boolean;
  required_autonomy_level: string;
  autonomy_reasons: string[];
}

export interface LatestState {
  perception: PerceptionData | null;
  cognition: CognitionData | null;
  action: ActionData | null;
  consensus: ConsensusData | null;
  escalation: any | null;
  status: any | null;
}

export interface LogEvent {
  time: string;
  channel: string;
  summary: string;
}


export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/status`);
  return res.json();
}

export async function fetchModelStatus(): Promise<ModelStatus> {
  const res = await fetch(`${API_BASE}/api/model/status`);
  return res.json();
}

export async function fetchLatestState(): Promise<LatestState> {
  const res = await fetch(`${API_BASE}/api/latest`);
  return res.json();
}

export async function fetchEvents(): Promise<LogEvent[]> {
  const res = await fetch(`${API_BASE}/api/events`);
  return res.json();
}

export async function fetchDecisions(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/decisions`);
  return res.json();
}

export async function startOrchestrator(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/orchestrator/start`, { method: "POST" });
  return res.json();
}

export async function stopOrchestrator(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/orchestrator/stop`, { method: "POST" });
  return res.json();
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string | null;
  duration_s: number | null;
}

export async function fetchScenarios(): Promise<{
  available: string[];
  scenarios: ScenarioInfo[];
  running: boolean;
  current: string | null;
}> {
  const res = await fetch(`${API_BASE}/api/scenarios`);
  return res.json();
}

export async function runScenario(name: string, speed: number = 5.0): Promise<any> {
  const res = await fetch(`${API_BASE}/api/scenario/${name}?speed=${speed}`, { method: "POST" });
  return res.json();
}

export async function sendHumanOverride(level: string, action: string, rationale: string = ""): Promise<any> {
  const res = await fetch(`${API_BASE}/api/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, action, rationale, operator: "commander" }),
  });
  return res.json();
}

export async function processPerceptionFrame(base64Image: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/perception/frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });
  return res.json();
}

export async function verifyAuditLog(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/audit/verify`);
  return res.json();
}

export async function sendChatMessage(text: string): Promise<{ response: string; route: string }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export function createMissionWebSocket(onMessage: (msg: any) => void): () => void {
  if (typeof window === "undefined") return () => {};

  let ws: WebSocket | null = null;
  let timer: any = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      ws = new WebSocket(WS_BASE);
      ws.onopen = () => {
        console.log("[SYMBIOSIS WS] Connected to Mission Control WebSocket");
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          onMessage(data);
        } catch (e) {
          console.error("[SYMBIOSIS WS] Parse error", e);
        }
      };
      ws.onclose = () => {
        if (!isClosed) {
          timer = setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
    } catch (e) {
      timer = setTimeout(connect, 2000);
    }
  }

  connect();

  return () => {
    isClosed = true;
    clearTimeout(timer);
    ws?.close();
  };
}
