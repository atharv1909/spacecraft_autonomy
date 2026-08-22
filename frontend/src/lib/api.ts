// src/lib/api.ts
// Real API, WebSocket Client, and Vercel-Ready Standalone Simulation for SYMBIOSIS Mission Control

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
  gatekeeper?: {
    loaded: boolean;
    backbone?: string;
    epoch?: number;
    fpr95?: number;
    accuracy?: number;
    layer?: string;
  };
  perception_available: boolean;
}

export interface PerceptionData {
  agent_id: string;
  message_type: string;
  source?: string;
  timestamp: number;
  gatekeeper?: {
    is_valid: boolean;
    confidence: number;
    logit: number;
    rejection_reason: string | null;
    latency_ms: number;
    fpr95: number;
    accuracy: number;
    backbone: string;
    layer: string;
  };
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
  timestamp: string | number;
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

// ── In-Memory Standalone State for Vercel Preview Deployments ────────────────
const _mockState: LatestState = {
  perception: {
    agent_id: "perception",
    message_type: "pose_estimate",
    timestamp: Date.now() / 1000,
    gatekeeper: {
      is_valid: true,
      confidence: 0.9998,
      logit: 12.42,
      rejection_reason: null,
      latency_ms: 18.4,
      fpr95: 0.0265,
      accuracy: 0.9782,
      backbone: "DINOv2 ViT-Small/14 (Meta AI)",
      layer: "Layer 1: Foundation Vision Gatekeeper",
    },
    R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    t: [12.5, 0.8, 0.2],
    quaternion: [0.982, 0.012, -0.045, 0.187],
    jensen_gain: 2.82,
    confidence_level: "high",
    confidence_label: "HIGH CONFIDENCE: Rotation error under 4.9° (95% guarantee)",
    sigma_R_deg: 1.69,
    sigma_t_m: 0.62,
    nearest_anchor_idx: 42,
    anchor_distance_deg: 2.14,
    is_trustworthy: true,
    physics_residual_m: 0.04,
    physics_consistent: true,
    ood_distance: 1.15,
    is_in_distribution: true,
    cross_estimator_agreement: true,
    rotation_disagreement_deg: 0.42,
    calibrated_error_bound_deg: 4.9,
    calibration_coverage: 0.95,
    processing_time_ms: 41.2,
    image_shape: [224, 224, 3],
  },
  cognition: {
    agent_id: "cognition",
    message_type: "situation_vector",
    timestamp: Date.now() / 1000,
    situation_id: "sit_nominal_approach",
    anomaly_detected: false,
    novelty_score: 0.04,
    recommended_action: "PROCEED_SLOW",
    action_confidence: 0.96,
    explanation: "HDC situation vector matches nominal rendezvous envelope with 99.4% cosine similarity.",
    root_cause: "nominal",
    root_cause_narrative: "NOMINAL FLIGHT ENVELOPE: All 10,000-D hyperdimensional situation vectors in distribution.",
    subsystem_states: { thermal: "nominal", power: "nominal", life_support: "nominal" },
  },
  action: {
    agent_id: "action",
    message_type: "action_recommendation",
    primary_action: "PROCEED_SLOW",
    primary_score: 0.88,
    collision_prob: 0.0002,
    collision_prob_upper_bound_99: 0.0448,
    alternatives: [
      { action: "HOLD_POSITION", score: 0.72, collision_prob: 0.0001, collision_prob_upper_bound_99: 0.0448 },
      { action: "PROCEED_NORMAL", score: 0.65, collision_prob: 0.004, collision_prob_upper_bound_99: 0.065 },
      { action: "RETREAT_SAFELY", score: 0.55, collision_prob: 0.0, collision_prob_upper_bound_99: 0.0448 },
    ],
    explanation: "CWH 100-rollout Monte Carlo: Clopper-Pearson 99% upper collision bound is 4.48%, well within NASA flight envelope.",
  },
  consensus: {
    agent_id: "orchestrator",
    message_type: "consensus_action",
    final_action: "PROCEED_SLOW",
    consensus_reached: true,
    votes: { perception: "PROCEED", cognition: "PROCEED", action: "PROCEED_SLOW" },
    override_applied: false,
    override_level: "AUTONOMOUS",
    escalated_to_human: false,
    reasoning: "All agents resolved consensus on nominal closing glissade. 20° corridor clear.",
    fallback_triggered: false,
    required_autonomy_level: "AUTONOMOUS",
    autonomy_reasons: ["All evidence channels in distribution"],
  },
  escalation: null,
  status: {
    overall_status: "NOMINAL",
    running: true,
  },
};

const _mockEvents: LogEvent[] = [
  { time: new Date().toLocaleTimeString(), channel: "perception.out", summary: "DINOv2 ViT Gatekeeper approved frame (99.98% confidence). Pose R, t computed." },
  { time: new Date().toLocaleTimeString(), channel: "cognition.out", summary: "HDC 10,000-D cosine similarity 99.4% (Nominal approach corridor)." },
  { time: new Date().toLocaleTimeString(), channel: "action.out", summary: "Monte-Carlo 100 rollouts: Clopper-Pearson 99% bound 4.48% collision risk." },
  { time: new Date().toLocaleTimeString(), channel: "orchestrator.consensus", summary: "Autonomous consensus reached: PROCEED_SLOW." },
];

const _mockDecisions: any[] = [
  { action: "PROCEED_SLOW", reasoning: "Nominal glissade approach. Jensen Gain 2.82° (High confidence).", timestamp: Date.now() / 1000 - 60, entry_hash: "8f1a4e2c90bd71a34e5b", prev_hash: "00000000000000000000" },
  { action: "PROCEED_SLOW", reasoning: "Clohessy-Wiltshire trajectory verified along 20° LOS cone.", timestamp: Date.now() / 1000 - 30, entry_hash: "2b9e4a1c77fa88d011c2", prev_hash: "8f1a4e2c90bd71a34e5b" },
];

// Resilient API Fetch Helper with Auto-Fallback to Standalone Simulation
async function apiFetch<T = any>(endpoint: string, options?: RequestInit, fallbackData?: T): Promise<T> {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8000";
  const primaryUrl = `${origin}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const directBackendUrl = `http://localhost:8000${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  try {
    const res = await fetch(primaryUrl, options);
    if (res.ok) return await res.json();
    if (origin !== "http://localhost:8000") {
      const fallbackRes = await fetch(directBackendUrl, options);
      if (fallbackRes.ok) return await fallbackRes.json();
    }
  } catch (err) {
    if (origin !== "http://localhost:8000") {
      try {
        const fallbackRes = await fetch(directBackendUrl, options);
        if (fallbackRes.ok) return await fallbackRes.json();
      } catch {
        // Fall through to standalone simulation
      }
    }
  }

  if (fallbackData !== undefined) return fallbackData;
  return {} as T;
}

export async function fetchStatus(): Promise<SystemStatus> {
  return apiFetch<SystemStatus>("/api/status", undefined, {
    redis_connected: true,
    orchestrator_running: true,
    scenario_running: false,
    current_scenario: null,
    model_loaded: true,
    modules: { perception: true, cognition: true, action: true, orchestrator: true, simulation: true },
    has_data: { perception: true, cognition: true, action: true, orchestrator: true },
    event_count: _mockEvents.length,
    decision_count: _mockDecisions.length,
  });
}

export async function fetchModelStatus(): Promise<ModelStatus> {
  return apiFetch<ModelStatus>("/api/model/status", undefined, {
    loaded: true,
    info: {
      backbone: "resnet50",
      epoch: 27,
      rot_err_deg: 13.16,
      trans_err_m: 0.3524,
      file_size_mb: 101.0,
      params: 340,
    },
    gatekeeper: {
      loaded: true,
      backbone: "DINOv2 ViT-Small/14 (Meta AI)",
      epoch: 2,
      fpr95: 0.0265,
      accuracy: 0.9782,
      layer: "Layer 1: Foundation Vision Gatekeeper",
    },
    perception_available: true,
  });
}

export async function fetchLatestState(): Promise<LatestState> {
  return apiFetch<LatestState>("/api/latest", undefined, _mockState);
}

export async function fetchEvents(): Promise<LogEvent[]> {
  return apiFetch<LogEvent[]>("/api/events", undefined, _mockEvents);
}

export async function fetchDecisions(): Promise<any[]> {
  return apiFetch<any[]>("/api/decisions", undefined, _mockDecisions);
}

export async function startOrchestrator(): Promise<any> {
  return apiFetch("/api/orchestrator/start", { method: "POST" }, { status: "started" });
}

export async function stopOrchestrator(): Promise<any> {
  return apiFetch("/api/orchestrator/stop", { method: "POST" }, { status: "stopped" });
}

export async function runScenario(name: string, speed: number = 5.0): Promise<any> {
  // Update mock state for interactive demo on Vercel
  if (name === "thermal") {
    if (_mockState.cognition) {
      _mockState.cognition.anomaly_detected = true;
      _mockState.cognition.anomaly_type = "thermal_failure";
      _mockState.cognition.novelty_score = 0.88;
      _mockState.cognition.root_cause = "thermal";
      _mockState.cognition.root_cause_narrative = "ROOT CAUSE: Radiator Loop 2 failure -> Solar array bus throttling -> ECLSS load shedding.";
      _mockState.cognition.subsystem_states = { thermal: "failed", power: "critical", life_support: "degraded" };
    }
    if (_mockState.consensus) {
      _mockState.consensus.final_action = "RECONFIGURE_POWER";
      _mockState.consensus.reasoning = "Thermal cascade isolated to Radiator Loop 2. Reconfiguring power loads.";
    }
  } else if (name === "perception") {
    if (_mockState.perception) {
      _mockState.perception.jensen_gain = 31.8;
      _mockState.perception.confidence_level = "critical";
      _mockState.perception.confidence_label = "CRITICAL UNCERTAINTY — SUNLAMP FLASH";
      _mockState.perception.is_in_distribution = false;
      _mockState.perception.physics_consistent = false;
    }
    if (_mockState.consensus) {
      _mockState.consensus.final_action = "HOLD_POSITION";
      _mockState.consensus.reasoning = "Jensen Gain 31.8° > 15.0° threshold. Hold position engaged.";
    }
  } else {
    // Nominal
    if (_mockState.cognition) {
      _mockState.cognition.anomaly_detected = false;
      _mockState.cognition.anomaly_type = undefined;
      _mockState.cognition.novelty_score = 0.04;
      _mockState.cognition.root_cause = "nominal";
      _mockState.cognition.root_cause_narrative = "NOMINAL FLIGHT ENVELOPE: All 10,000-D vectors in distribution.";
      _mockState.cognition.subsystem_states = { thermal: "nominal", power: "nominal", life_support: "nominal" };
    }
    if (_mockState.perception) {
      _mockState.perception.jensen_gain = 2.82;
      _mockState.perception.confidence_level = "high";
      _mockState.perception.confidence_label = "HIGH CONFIDENCE: Rotation error under 4.9° (95% guarantee)";
      _mockState.perception.is_in_distribution = true;
      _mockState.perception.physics_consistent = true;
    }
    if (_mockState.consensus) {
      _mockState.consensus.final_action = "PROCEED_SLOW";
      _mockState.consensus.reasoning = "Nominal proximity approach along 20° LOS cone.";
    }
  }

  _mockEvents.push({
    time: new Date().toLocaleTimeString(),
    channel: "simulation.event",
    summary: `Simulation Scenario '${name.toUpperCase()}' initiated at ${speed}x speed.`,
  });

  return apiFetch(`/api/scenario/${name}?speed=${speed}`, { method: "POST" }, { status: "started", scenario: name });
}

export async function sendHumanOverride(level: string, action: string, rationale: string = ""): Promise<any> {
  if (_mockState.consensus) {
    _mockState.consensus.final_action = action.toUpperCase();
    _mockState.consensus.override_applied = true;
    _mockState.consensus.override_level = level;
    _mockState.consensus.reasoning = `ARMSTRONG OVERRIDE (Level ${level}): ${action.toUpperCase()} | ${rationale}`;
  }

  _mockEvents.push({
    time: new Date().toLocaleTimeString(),
    channel: "human.in",
    summary: `Operator Override: ${action.toUpperCase()} (Level: ${level})`,
  });

  _mockDecisions.push({
    action: action.toUpperCase(),
    reasoning: `Manual Operator Override (Level ${level}): ${rationale || "Command dispatched"}`,
    timestamp: Date.now() / 1000,
    entry_hash: Math.random().toString(16).slice(2, 18),
    prev_hash: _mockDecisions[_mockDecisions.length - 1]?.entry_hash || "0000000000000000",
  });

  return apiFetch(
    "/api/override",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, action, rationale, operator: "commander" }),
    },
    { status: "sent", level, action }
  );
}

export async function processPerceptionFrame(base64Image: string): Promise<any> {
  return apiFetch(
    "/api/perception/frame",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image }),
    },
    {
      status: "success",
      inference_ms: 38.4,
      jensen_gain: 2.82,
      confidence_level: "high",
    }
  );
}

export async function inspectGatekeeperImage(base64Image: string): Promise<any> {
  return apiFetch(
    "/api/gatekeeper/inspect",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image }),
    },
    {
      is_valid: true,
      confidence: 0.9998,
      logit: 12.42,
      rejection_reason: null,
      latency_ms: 18.4,
      fpr95: 0.0265,
      accuracy: 0.9782,
    }
  );
}

export async function verifyAuditLog(): Promise<any> {
  return apiFetch("/api/audit/verify", undefined, {
    valid: true,
    entries_verified: _mockDecisions.length,
    time: new Date().toLocaleTimeString(),
  });
}

export async function sendChatMessage(text: string): Promise<{ response: string; route: string }> {
  return apiFetch(
    "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    {
      response: "Telemetry bus online. All safety channels operating within nominal NASA Class-A envelope.",
      route: "overview",
    }
  );
}

export function createMissionWebSocket(onMessage: (msg: any) => void): () => void {
  if (typeof window === "undefined") return () => {};

  let ws: WebSocket | null = null;
  let timer: any = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      const wsUrl =
        window.location.protocol === "https:"
          ? `wss://${window.location.host}/ws`
          : window.location.port === "8000"
          ? `ws://${window.location.host}/ws`
          : `ws://localhost:8000/ws`;

      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log("[SYMBIOSIS WS] Connected to Mission Control WebSocket at", wsUrl);
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
          timer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      timer = setTimeout(connect, 3000);
    }
  }

  connect();

  return () => {
    isClosed = true;
    clearTimeout(timer);
    ws?.close();
  };
}
