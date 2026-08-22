// src/lib/armstrong.ts
// Client for the Armstrong Console override wizard.
//
// Every value rendered by the wizard comes back from these calls — the UI holds
// no fallback numbers of its own. If a request fails the screen says so rather
// than inventing telemetry.

import { API_BASE } from "./endpoints";

export type OverrideLevel = "acknowledge" | "modify" | "replace" | "reject";

export interface RecoveryPathway {
  id: string;
  title: string;
  icon: string;
  description: string;
  plain_explanation: string;
  mathematical_basis: string;
  predicted_jg_deg: number;
  delta_v_mps: number;
  confidence_gain_pct: number;
  urgency: "CRITICAL" | "RECOMMENDED" | "ALTERNATIVE";
  action_result: string;
}

export interface FlightSnapshot {
  r_vec: number[];
  v_vec: number[];
  jensen_gain_deg: number;
  sigma_t_m: number;
  sigma_R_deg: number;
  is_trustworthy: boolean;
  anomaly_detected: boolean;
  anomaly_type: string;
  escalation_reason: string;
  situation_id: string;
  range_m: number;
  off_axis_deg: number;
  cone_margin_deg: number;
  max_safe_velocity_mps: number;
  range_rate_mps: number;
  flight_phase: string;
  tripwire_triggered: boolean;
  /** False when only one frame exists, so velocity could not be measured. */
  velocity_observed: boolean;
  frames_used: number;
  frame_interval_s: number | null;
}

export interface ArmstrongSession {
  session_id: string;
  situation_id: string;
  level: OverrideLevel;
  opened_at: number;
  timeout_s: number;
  deadline_ts: number;
  remaining_s: number;
  expired: boolean;
  timeout_action: string;
  timeout_label: string;
  committed: boolean;
  committed_at: number | null;
  escalation_reason: string;
  opened_jensen_gain_deg: number;
  snapshot: FlightSnapshot;
  pathways: RecoveryPathway[];
  selection: Record<string, unknown>;
  live_jensen_gain_deg: number;
  jensen_gain_drift_deg: number;
  situation_changed: boolean;
  crew_notified: boolean;
  thresholds: Thresholds | null;
  audit: { valid: boolean; entries_verified?: number; broken_at_line?: number };
}

export interface ConformalBin {
  jg_lo: number;
  jg_hi: number;
  n_calib_samples: number;
  guaranteed_error_bound_deg: number;
}

/** Every gate constant, read off the perception modules rather than restated. */
export interface Thresholds {
  high_confidence_thresh_deg: number;
  moderate_thresh_deg: number;
  ood_threshold_99th: number | null;
  physics_residual_threshold_m: number | null;
  conformal: { coverage: number; bins: ConformalBin[] } | null;
  hopf_anchors: number | null;
  hopf_elevation: number | null;
  hopf_inplane: number | null;
}

export interface PerceptionFrame {
  timestamp: number;
  jensen_gain: number;
  sigma_R_deg: number;
  sigma_t_m: number;
  ood_distance: number;
  physics_residual_m: number;
  calibrated_error_bound_deg: number;
  range_m: number;
  r_vec: number[] | null;
  is_trustworthy: boolean;
  is_in_distribution: boolean;
  physics_consistent: boolean;
  source: string;
}

export interface ParameterSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  role: string;
  description: string;
  decimals: number;
}

export interface CollisionResult {
  n_monte_carlo: number;
  horizon_s: number;
  keepout_radius_m: number;
  breach_count: number;
  collision_prob: number;
  collision_prob_upper_bound_99: number;
  min_distance_mean_m: number;
  min_distance_p05_m: number;
  trajectory_mean: number[][];
  sigma_r_m: number;
  sigma_v_mps: number;
}

export interface Evaluation {
  pathway: string;
  values: Record<string, number>;
  predicted_jensen_gain_deg: number;
  jensen_gain_delta_deg: number;
  confidence_gain_pct: number;
  delta_v_mps: number;
  command_duration_s: number;
  command_basis: string;
  velocity_observed: boolean;
  collision: CollisionResult;
  mission_success_prob: number;
  resulting_action: string;
}

export interface Preset {
  id: string;
  pathway: string;
  label: string;
  description: string;
  values: Record<string, number>;
  evaluation: Evaluation;
}

export interface ParametersResponse {
  session_id: string;
  pathway: string;
  pathway_meta: RecoveryPathway | null;
  snapshot: FlightSnapshot;
  specs: ParameterSpec[];
  presets: Preset[];
  recommended_preset: string | null;
}

export interface PrecommitCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  metric: number;
  limit: number;
}

export interface Validation {
  checks: PrecommitCheck[];
  all_passed: boolean;
  failed: string[];
  audit: { valid: boolean; entries_verified?: number; broken_at_line?: number };
}

export interface PrecommitResponse {
  session_id: string;
  review_id: string;
  situation_id: string;
  evaluation: Evaluation;
  validation: Validation;
  countdown: {
    remaining_s: number;
    deadline_ts: number;
    timeout_action: string;
    timeout_label: string;
  };
}

export interface OverrideRecord {
  session_id: string;
  situation_id: string;
  override_level: string;
  operator: string;
  pathway: string;
  pathway_title: string;
  preset: string | null;
  parameters: Record<string, number>;
  rationale: string;
  predicted_jensen_gain_deg: number;
  jensen_gain_at_open_deg: number;
  delta_v_mps: number;
  collision_prob_upper_bound_99: number;
  command_duration_s: number;
  resulting_action: string;
  precommit: Record<string, boolean>;
  precommit_overridden: boolean;
  entry_hash: string;
  timestamp: number;
  time: string;
}

export interface CommitResponse {
  status: string;
  session_id: string;
  entry_hash: string;
  level: string;
  pathway: string;
  pathway_title: string;
  action: string;
  rationale: string;
  evaluation: Evaluation;
  validation: Validation;
  override: OverrideRecord;
  audit: { valid: boolean; entries_verified?: number };
}

/** Thrown for a non-2xx response so callers can branch on the server's reason. */
export class ArmstrongError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.detail || body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || (body && body.error)) {
    throw new ArmstrongError(res.status, body);
  }
  return body as T;
}

export function openSession(level: OverrideLevel): Promise<ArmstrongSession> {
  return call("/api/armstrong/session/open", {
    method: "POST",
    body: JSON.stringify({ level }),
  });
}

export function getSession(sessionId: string): Promise<ArmstrongSession> {
  return call(`/api/armstrong/session/${sessionId}`);
}

export function getParameters(sessionId: string, pathway: string): Promise<ParametersResponse> {
  return call(`/api/armstrong/session/${sessionId}/parameters?pathway=${encodeURIComponent(pathway)}`);
}

export function evaluateParameters(
  sessionId: string,
  pathway: string,
  values: Record<string, number>,
): Promise<{ session_id: string; snapshot: FlightSnapshot; evaluation: Evaluation }> {
  return call(`/api/armstrong/session/${sessionId}/evaluate`, {
    method: "POST",
    body: JSON.stringify({ pathway, values }),
  });
}

export function precommit(
  sessionId: string,
  pathway: string,
  values: Record<string, number>,
): Promise<PrecommitResponse> {
  return call(`/api/armstrong/session/${sessionId}/precommit`, {
    method: "POST",
    body: JSON.stringify({ pathway, values }),
  });
}

export function commit(
  sessionId: string,
  payload: {
    pathway: string;
    values: Record<string, number>;
    preset?: string | null;
    level: OverrideLevel;
    rationale: string;
    operator: string;
    acknowledge_failed_checks?: boolean;
  },
): Promise<CommitResponse> {
  return call(`/api/armstrong/session/${sessionId}/commit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function emergencyAbort(payload: {
  rationale: string;
  operator: string;
  session_id?: string | null;
}): Promise<CommitResponse> {
  return call("/api/armstrong/abort", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchThresholds(): Promise<Thresholds> {
  return call("/api/config/thresholds");
}

export function fetchPerceptionHistory(
  limit = 120,
): Promise<{ count: number; frames: PerceptionFrame[]; frame_interval_s: number | null }> {
  return call(`/api/perception/history?limit=${limit}`);
}

/**
 * The capture cadence between successive frames — the one quantity the imagery
 * itself cannot supply. Velocity, closing rate and the propagated CWH state
 * are all unavailable until an operator declares it.
 */
export function setFrameInterval(
  frameIntervalS: number | null,
): Promise<{ frame_interval_s: number | null }> {
  return call("/api/perception/frame_interval", {
    method: "POST",
    body: JSON.stringify({ frame_interval_s: frameIntervalS }),
  });
}

export function fetchOverrides(): Promise<{
  count: number;
  audit: { valid: boolean; entries_verified?: number };
  overrides: OverrideRecord[];
}> {
  return call("/api/armstrong/overrides");
}

export interface RecoveryOptionsResponse {
  tripwire_triggered: boolean;
  tripwire_reason: string;
  flight_phase: string;
  range_m: number;
  cone_margin_deg: number;
  in_approach_cone: boolean;
  current_jensen_gain: number;
  is_trustworthy: boolean;
  velocity_observed: boolean;
  frames_used: number;
  pathways_count: number;
  range_rate_mps: number;
  max_safe_velocity_mps: number;
  commanded_mode: string;
  cam_delta_v_mps: number[];
  cone_half_angle_deg: number;
  koz_radius_m: number;
  keepout_radius_m: number;
  collision_bound_limit: number;
  n_monte_carlo: number;
  options: RecoveryPathway[];
}

/** The dashboard's Section 5 grid reads from the same endpoint the wizard does. */
export function fetchRecoveryOptions(): Promise<RecoveryOptionsResponse> {
  return call("/api/recovery/options");
}

export function simulateTripwire(
  tripwireType: "optical_glare" | "corridor_departure" | "sensor_anomaly",
): Promise<any> {
  return call("/api/recovery/simulate_tripwire", {
    method: "POST",
    body: JSON.stringify({ tripwire_type: tripwireType }),
  });
}

// ---------------------------------------------------------------------------
// Presentation helpers derived purely from the numbers
// ---------------------------------------------------------------------------

/**
 * Badge class for a pathway card. Derived from the sign and rank of the
 * computed confidence gain so it can never drift out of sync with the data:
 * a negative gain is always CRITICAL, the best gain is RECOMMENDED, the rest
 * are ALTERNATIVE.
 */
export function deriveBadge(
  pathway: RecoveryPathway,
  all: RecoveryPathway[],
): "CRITICAL" | "RECOMMENDED" | "ALTERNATIVE" {
  if (pathway.confidence_gain_pct < 0) return "CRITICAL";
  const best = all.reduce(
    (acc, p) => (p.confidence_gain_pct > acc ? p.confidence_gain_pct : acc),
    -Infinity,
  );
  if (pathway.confidence_gain_pct === best) return "RECOMMENDED";
  return "ALTERNATIVE";
}

export function badgeClasses(badge: string): string {
  switch (badge) {
    case "CRITICAL":
      return "bg-lacquer-red/10 border-lacquer-red/40 text-lacquer-red";
    case "RECOMMENDED":
      return "bg-moss-accent/10 border-moss-accent/40 text-moss-accent";
    default:
      return "bg-surface-container border-outline-variant text-on-surface-variant";
  }
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatValue(value: number, decimals: number): string {
  return Number(value).toFixed(decimals);
}
