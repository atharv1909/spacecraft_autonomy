"""
Armstrong Console — server-side engine for the human-in-the-loop override wizard.

This module is the single source of truth behind the three-step Armstrong
Console flow (Pathway -> Parameters -> Safety Review). Nothing here is a fixed
display string: every number the operator sees is computed from live telemetry
plus the values the operator themselves typed into the wizard.

Composition:
  * Recovery pathways come from NASAAutonomousFlightDirector.generate_dynamic_recovery_options
    (the same call that feeds dashboard Section 5), so the dashboard and the
    wizard can never drift apart.
  * Tunable parameters are derived per pathway from the current flight state
    (range, off-axis angle, Jensen Gain, max safe velocity), so their bounds
    move with the mission.
  * Collision probability is a Clohessy-Wiltshire Monte-Carlo whose 99% upper
    bound uses the project's exact Clopper-Pearson estimator.
  * Audit integrity is the live result of HashChainedLog.verify().

Observability rule
------------------
This console is fed by a monocular camera. Every quantity it reports is
therefore derived from the pose estimate and the orbital dynamics that follow
from it. Vehicle housekeeping that a photograph cannot observe — thruster duty
cycles, propellant mass, tank pressures, component temperatures, link budgets —
is deliberately absent rather than estimated from assumed constants.
"""

from __future__ import annotations

import math
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

import numpy as np

from .fdir_flight_director import NASAAutonomousFlightDirector
from .audit_log import HashChainedLog

try:
    from action.agent import clopper_pearson_upper_bound
    _CP_AVAILABLE = True
except Exception:  # pragma: no cover - scipy may be unavailable
    _CP_AVAILABLE = False

    def clopper_pearson_upper_bound(n_successes: int, n_trials: int,
                                    confidence: float = 0.99) -> float:
        """Conservative normal-approximation fallback when scipy is unavailable."""
        if n_trials <= 0:
            return 1.0
        p = n_successes / n_trials
        z = 2.5758  # 99% one-sided normal quantile
        return float(min(1.0, p + z * math.sqrt(max(p * (1 - p), 1e-9) / n_trials) + 1.0 / n_trials))


# ---------------------------------------------------------------------------
# Flight constants (physical, not presentational)
# ---------------------------------------------------------------------------
MU_EARTH = 3.986004418e14          # m^3/s^2
ORBIT_SEMI_MAJOR_M = 6.778e6       # ~400 km circular LEO
MEAN_MOTION_RAD_S = math.sqrt(MU_EARTH / ORBIT_SEMI_MAJOR_M ** 3)

KEEPOUT_RADIUS_M = 2.0             # hard keep-out sphere around the target
COLLISION_BOUND_LIMIT = 0.05       # 5% ceiling on the 99% upper bound
N_MONTE_CARLO = 400                # ensemble size for the CWH rollout
JG_SENSOR_FLOOR_DEG = 1.8          # best achievable spread for this pose model

#: Pathways whose effect cannot be confirmed from the optical chain alone.
#: The flight director still computes them; the console does not offer them,
#: because it has no way to show the operator whether they worked.
UNOBSERVABLE_PATHWAYS = frozenset({"tam_thruster_realloc"})


def observable_pathways(options: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter the flight director's options down to those a camera can verify."""
    return [o for o in options if o.get("id") not in UNOBSERVABLE_PATHWAYS]


# ---------------------------------------------------------------------------
# Parameter specification
# ---------------------------------------------------------------------------
@dataclass
class ParameterSpec:
    """One operator-editable knob on the Parameters step."""
    key: str
    label: str
    unit: str
    minimum: float
    maximum: float
    step: float
    default: float
    role: str            # physics role consumed by the evaluator
    description: str
    decimals: int = 2

    def clamp(self, value: float) -> float:
        return float(np.clip(float(value), self.minimum, self.maximum))

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["min"] = d.pop("minimum")
        d["max"] = d.pop("maximum")
        return d


def _round_to(value: float, step: float) -> float:
    if step <= 0:
        return float(value)
    return float(round(value / step) * step)


# ---------------------------------------------------------------------------
# Telemetry snapshot
# ---------------------------------------------------------------------------
@dataclass
class FlightSnapshot:
    """Live flight state the wizard is reasoning about."""
    r_vec: List[float]
    v_vec: List[float]
    jensen_gain_deg: float
    sigma_t_m: float
    sigma_R_deg: float
    is_trustworthy: bool
    anomaly_detected: bool
    anomaly_type: str
    escalation_reason: str
    situation_id: str
    range_m: float = 0.0
    off_axis_deg: float = 0.0
    cone_margin_deg: float = 0.0
    max_safe_velocity_mps: float = 0.0
    range_rate_mps: float = 0.0
    flight_phase: str = "CLOSING_GLISSADE"
    tripwire_triggered: bool = False
    #: Relative velocity needs two pose fixes AND the interval between them.
    #: False means one of those is missing, so v_vec is zero and every
    #: velocity-derived readout is reported as unavailable rather than guessed.
    velocity_observed: bool = False
    frames_used: int = 0
    #: Capture cadence the operator declared, in seconds. None when unset.
    frame_interval_s: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class NoOpticalEvidence(RuntimeError):
    """Raised when no pose estimate exists yet, so nothing can be computed."""


def _velocity_from_history(history: List[Dict[str, Any]],
                           frame_interval_s: Optional[float] = None) -> tuple:
    """Finite-difference the relative velocity out of consecutive pose fixes.

    A single photograph carries no velocity information; two pose fixes taken a
    known interval apart do. The interval is the part the image cannot supply —
    a server receive-time gap measures how fast frames were submitted, not how
    fast the vehicle moved. So the operator declares the capture cadence and
    the velocity follows from it. Without a declared interval the velocity is
    reported as unobserved rather than inferred from upload timing.
    """
    usable = [f for f in (history or []) if f.get("r_vec")]
    if len(usable) < 2 or frame_interval_s is None or frame_interval_s <= 0:
        return [0.0, 0.0, 0.0], False, len(usable)

    r_prev = usable[-2]["r_vec"]
    r_curr = usable[-1]["r_vec"]
    if not r_prev or not r_curr or len(r_prev) < 3 or len(r_curr) < 3:
        return [0.0, 0.0, 0.0], False, len(usable)

    dt = float(frame_interval_s)
    v = [(float(r_curr[i]) - float(r_prev[i])) / dt for i in range(3)]
    return v, True, len(usable)


def build_snapshot(latest: Dict[str, Any],
                   history: Optional[List[Dict[str, Any]]] = None,
                   frame_interval_s: Optional[float] = None,
                   director: Optional[NASAAutonomousFlightDirector] = None) -> FlightSnapshot:
    """Derive a FlightSnapshot from the optical chain's own output.

    Raises NoOpticalEvidence when no frame has been processed, because every
    downstream number depends on the pose estimate and there is no defensible
    substitute for it.
    """
    perc = latest.get("perception") or {}
    cog = latest.get("cognition") or {}
    cons = latest.get("consensus") or {}
    esc = latest.get("escalation") or {}

    t_vec = perc.get("t")
    if not t_vec or len(t_vec) < 3:
        raise NoOpticalEvidence(
            "No pose estimate is available. Submit a frame to the perception "
            "agent before opening the console."
        )

    r_vec = [float(x) for x in t_vec]
    v_vec, v_observed, n_frames = _velocity_from_history(history, frame_interval_s)
    jg = float(perc.get("jensen_gain", 0.0))

    director = director or NASAAutonomousFlightDirector()
    safety = director.evaluate_safety_step(
        r_vec=np.array(r_vec),
        v_vec=np.array(v_vec),
        jensen_gain_deg=jg,
        is_trustworthy=bool(perc.get("is_trustworthy", True)),
    )

    reason = (
        esc.get("reason")
        or cog.get("explanation")
        or cons.get("reasoning")
        or safety.tripwire_reason
    )

    return FlightSnapshot(
        r_vec=r_vec,
        v_vec=v_vec,
        jensen_gain_deg=jg,
        sigma_t_m=float(perc.get("sigma_t_m") or 0.0),
        sigma_R_deg=float(perc.get("sigma_R_deg") or 0.0),
        is_trustworthy=bool(perc.get("is_trustworthy", True)),
        anomaly_detected=bool(cog.get("anomaly_detected", False)),
        anomaly_type=str(cog.get("anomaly_type", "none")),
        escalation_reason=str(reason),
        situation_id=str(cog.get("situation_id") or cons.get("message_id") or "sit_unknown"),
        range_m=safety.range_m,
        off_axis_deg=round(director.cone_half_angle - safety.cone_margin_deg, 2),
        cone_margin_deg=safety.cone_margin_deg,
        max_safe_velocity_mps=safety.max_safe_velocity_mps,
        range_rate_mps=safety.range_rate_mps,
        flight_phase=safety.phase.value,
        tripwire_triggered=safety.tripwire_triggered,
        velocity_observed=v_observed,
        frames_used=n_frames,
        frame_interval_s=frame_interval_s,
    )


# ---------------------------------------------------------------------------
# Per-pathway parameter specs — bounds are functions of the live flight state
# ---------------------------------------------------------------------------
def parameter_specs_for(pathway_id: str, snap: FlightSnapshot) -> List[ParameterSpec]:
    jg = snap.jensen_gain_deg
    rng = max(0.5, snap.range_m)
    v_max = max(0.05, snap.max_safe_velocity_mps)

    if pathway_id == "boresight_realign":
        # Target must stay inside the 45 deg FOV: usable slew shrinks as the
        # target drifts off the optical boresight.
        max_slew = float(np.clip(22.5 - snap.off_axis_deg * 0.5, 3.0, 15.0))
        return [
            ParameterSpec("slew_deg", "Boresight Slew Angle", "deg", 1.0, round(max_slew, 1), 0.5,
                          round(float(np.clip(5.0, 1.0, max_slew)), 1), "glare_rejection",
                          "Off-sun optical gimbal rotation. Larger angles reject more specular "
                          "glare but push the target toward the edge of the 45 deg FOV.", 1),
            ParameterSpec("settle_time_s", "Gimbal Settle Time", "s", 4.0, 60.0, 1.0, 15.0,
                          "slew_duration",
                          "Time allotted for the slew. Shorter settles leave more residual body-rate "
                          "smear in the frame.", 0),
            ParameterSpec("frames_averaged", "Post-Slew Frames Averaged", "frames", 1, 64, 1, 8,
                          "temporal_averaging",
                          "Pose frames temporally averaged after the slew. Spread falls as "
                          "1/sqrt(N) but each frame costs wall-clock time.", 0),
        ]

    if pathway_id == "template_pnp_crosscheck":
        return [
            ParameterSpec("keypoints", "PnP Keypoints Used", "pts", 6, 16, 1, 11, "geometric_gate",
                          "Known Tango corner features fed to the EPnP solver. More keypoints "
                          "tighten the geometric fit but need more of the body to be lit.", 0),
            ParameterSpec("gate_threshold_deg", "Dual-Trust Gate", "deg", 1.0, 10.0, 0.5, 5.0,
                          "geometric_gate_threshold",
                          "Maximum permitted geodesic disagreement between the neural pose and the "
                          "PnP pose before the frame is rejected.", 1),
            ParameterSpec("frames_averaged", "Cross-Check Frames", "frames", 1, 32, 1, 6,
                          "temporal_averaging",
                          "Consecutive frames that must pass the gate before trust is restored.", 0),
        ]

    if pathway_id == "reconfigure_trajectory":
        # Cross-track nulling: dv scales with how far off the centerline we are.
        nominal_dv = float(np.clip(snap.off_axis_deg * 0.015 + 0.02, 0.02, 0.18))
        return [
            ParameterSpec("target_cone_margin_deg", "Target Cone Margin", "deg", 2.0, 18.0, 0.5,
                          round(float(np.clip(snap.cone_margin_deg + 8.0, 5.0, 18.0)), 1),
                          "cone_margin",
                          "Line-of-sight margin to re-establish inside the 20 deg approach cone. "
                          "Deeper re-centering costs proportionally more delta-V.", 1),
            ParameterSpec("burn_dv_mps", "Cross-Track Delta-V", "m/s", 0.005, 0.30, 0.005,
                          round(nominal_dv, 3), "dv_budget",
                          "Impulsive CWH cross-track burn magnitude. Sets how fast the corridor is "
                          "recovered.", 3),
            ParameterSpec("burn_duration_s", "Burn Duration", "s", 2.0, 120.0, 1.0, 20.0,
                          "burn_duration",
                          "Duration over which the delta-V is applied.", 0),
        ]

    if pathway_id == "mekf_attitude_reset":
        return [
            ParameterSpec("covariance_inflation", "Covariance Inflation", "x", 1.0, 100.0, 1.0, 10.0,
                          "filter_reset",
                          "Multiplier applied to the MEKF state covariance at reset. Larger values "
                          "let the filter forget a corrupted history faster.", 0),
            ParameterSpec("bias_reset_pct", "Gyro Bias Reset", "%", 0.0, 100.0, 5.0, 100.0,
                          "filter_bias_reset",
                          "Fraction of the accumulated gyro bias estimate that is zeroed.", 0),
            ParameterSpec("frames_averaged", "Reconvergence Frames", "frames", 1, 64, 1, 12,
                          "temporal_averaging",
                          "Frames the filter reconverges over before trust is re-evaluated.", 0),
        ]

    if pathway_id == "conformal_envelope_clamp":
        return [
            ParameterSpec("coverage_pct", "Conformal Coverage", "%", 80.0, 99.5, 0.5, 95.0,
                          "coverage",
                          "Distribution-free coverage level for the translational error bound. "
                          "Higher coverage means a wider, safer, slower envelope.", 1),
            ParameterSpec("velocity_clamp_mps", "Max Approach Velocity", "m/s", 0.01,
                          round(v_max, 3), 0.005,
                          round(float(np.clip(v_max * 0.5, 0.01, v_max)), 3), "velocity_clamp",
                          "Hard ceiling on closing rate. The braking burn needed to honour this "
                          "clamp is what drives the delta-V cost.", 3),
            ParameterSpec("standoff_margin_m", "Added Standoff Margin", "m", 0.0,
                          round(float(np.clip(rng * 0.25, 0.5, 4.0)), 2), 0.05, 0.5, "standoff",
                          "Extra separation added on top of the keep-out sphere before contact is "
                          "permitted.", 2),
        ]

    # station_keeping_recalibrate (default)
    return [
        ParameterSpec("standoff_m", "Hold Standoff Range", "m",
                      round(float(np.clip(rng * 0.6, KEEPOUT_RADIUS_M + 0.5, max(rng, 3.0))), 2),
                      round(float(max(rng * 1.6, KEEPOUT_RADIUS_M + 2.0)), 2), 0.1,
                      round(float(rng), 2), "standoff",
                      "Range at which the vehicle parks. Backing off costs delta-V but buys "
                      "collision margin.", 2),
        ParameterSpec("hold_duration_s", "Hold Duration", "s", 30.0, 900.0, 10.0, 120.0,
                      "hold_duration",
                      "Wall-clock time held stationary while diagnostics run.", 0),
        ParameterSpec("frames_averaged", "HDC Probe Frames", "frames", 4, 64, 1, 16,
                      "temporal_averaging",
                      "Frames averaged into the temporal probe queried against the 10,000-D "
                      "associative memory.", 0),
    ]


# ---------------------------------------------------------------------------
# Presets — computed positions within each spec's live range
# ---------------------------------------------------------------------------
_PRESET_PROFILES = [
    ("tightened", "Tightened Envelope",
     "Maximum safety margin. Spends more delta-V and schedule to buy the tightest "
     "predicted uncertainty.", 0.85),
    ("standard", "Standard Envelope",
     "Balances centring force against available safety margin. Sits at the midpoint of "
     "every live parameter range.", 0.5),
    ("minimal", "Minimal Constraint",
     "Least schedule and delta-V impact, lowest safety margin. Fastest execution.", 0.18),
]

# Which direction "more conservative" runs for each physics role.
_CONSERVATIVE_DIRECTION = {
    "glare_rejection": +1,
    "slew_duration": +1,
    "temporal_averaging": +1,
    "geometric_gate": +1,
    "geometric_gate_threshold": -1,
    "cone_margin": +1,
    "dv_budget": +1,
    "burn_duration": +1,
    "filter_reset": +1,
    "filter_bias_reset": +1,
    "coverage": +1,
    "velocity_clamp": -1,
    "standoff": +1,
    "hold_duration": +1,
}


def presets_for(pathway_id: str, specs: List[ParameterSpec]) -> List[Dict[str, Any]]:
    """Build three preset parameter sets by sliding every knob along its own
    conservative axis. Nothing is typed in by hand: a preset is a position in
    the live parameter space, so presets differ per pathway automatically."""
    presets: List[Dict[str, Any]] = []
    for pid, label, description, aggression in _PRESET_PROFILES:
        values: Dict[str, float] = {}
        for spec in specs:
            direction = _CONSERVATIVE_DIRECTION.get(spec.role, +1)
            # frac = 0 -> permissive end, 1 -> conservative end
            frac = aggression if direction > 0 else (1.0 - aggression)
            raw = spec.minimum + frac * (spec.maximum - spec.minimum)
            values[spec.key] = spec.clamp(_round_to(raw, spec.step))
        presets.append({
            "id": pid,
            "pathway": pathway_id,
            "label": label,
            "description": description,
            "values": values,
        })
    return presets


# ---------------------------------------------------------------------------
# Physics evaluation
# ---------------------------------------------------------------------------
def _cwh_state_transition(dt: float, n: float) -> np.ndarray:
    """Closed-form Clohessy-Wiltshire state transition matrix (6x6)."""
    s, c = math.sin(n * dt), math.cos(n * dt)
    phi = np.zeros((6, 6))
    phi[0, 0] = 4 - 3 * c
    phi[0, 3] = s / n
    phi[0, 4] = 2 * (1 - c) / n
    phi[1, 0] = 6 * (s - n * dt)
    phi[1, 1] = 1.0
    phi[1, 3] = -2 * (1 - c) / n
    phi[1, 4] = (4 * s - 3 * n * dt) / n
    phi[2, 2] = c
    phi[2, 5] = s / n
    phi[3, 0] = 3 * n * s
    phi[3, 3] = c
    phi[3, 4] = 2 * s
    phi[4, 0] = -6 * n * (1 - c)
    phi[4, 3] = -2 * s
    phi[4, 4] = 4 * c - 3
    phi[5, 2] = -n * s
    phi[5, 5] = c
    return phi


def _predicted_jensen_gain(pathway_id: str, params: Dict[str, float],
                           snap: FlightSnapshot) -> float:
    """Forward model of residual rotational spread after the maneuver.

    Each physics role contributes a multiplicative retention factor in [0,1]
    applied to the current Jensen Gain; the result is floored at the pose
    model's own calibrated spread. Every factor is a monotone function of a
    value the operator can move, so the readout reacts to real edits.
    """
    jg = float(snap.jensen_gain_deg)
    retention = 1.0

    if "slew_deg" in params:
        # Specular lobe falls off roughly exponentially with off-sun angle.
        retention *= float(np.clip(math.exp(-params["slew_deg"] / 2.2), 0.06, 1.0))

    if "keypoints" in params:
        kp = params["keypoints"]
        gate = params.get("gate_threshold_deg", 5.0)
        retention *= float(np.clip(0.42 - 0.022 * (kp - 6) + 0.018 * (gate - 1.0), 0.08, 1.0))

    if "covariance_inflation" in params:
        infl = max(1.0, params["covariance_inflation"])
        bias = params.get("bias_reset_pct", 100.0) / 100.0
        retention *= float(np.clip(0.75 - 0.30 * bias - 0.16 * math.log10(infl), 0.10, 1.0))

    if "coverage_pct" in params:
        # A tighter conformal envelope certifies a tighter spread.
        cov = params["coverage_pct"]
        retention *= float(np.clip(0.34 - (cov - 80.0) / 19.5 * 0.16, 0.12, 1.0))

    if "target_cone_margin_deg" in params:
        retention *= float(np.clip(0.40 - 0.012 * params["target_cone_margin_deg"], 0.15, 1.0))

    if "standoff_m" in params:
        # Backing off improves angular subtense conditioning of the solve.
        ratio = params["standoff_m"] / max(0.5, snap.range_m)
        retention *= float(np.clip(0.45 - 0.10 * (ratio - 1.0), 0.15, 1.0))

    if "frames_averaged" in params:
        n_f = max(1.0, params["frames_averaged"])
        retention *= float(np.clip(0.30 + 0.70 / math.sqrt(n_f), 0.20, 1.0))

    if "settle_time_s" in params:
        # Insufficient settle leaves residual body-rate smear in the frame.
        retention *= float(np.clip(1.35 - 0.030 * params["settle_time_s"], 1.0, 1.35))

    predicted = jg * retention + JG_SENSOR_FLOOR_DEG * (1.0 - retention)
    return round(float(np.clip(predicted, JG_SENSOR_FLOOR_DEG, max(jg, JG_SENSOR_FLOOR_DEG))), 2)


def _commanded_delta_v(pathway_id: str, params: Dict[str, float],
                       snap: FlightSnapshot) -> Dict[str, Any]:
    """Translate operator parameters into a commanded delta-V.

    Delta-V is kinematic: it falls out of the CWH geometry and the pose
    estimate, so it is reportable. What that would cost in propellant is not —
    that needs tank mass, Isp and thruster telemetry no camera can see — so
    this returns the velocity change and its duration, and nothing else.
    """
    dv_target = 0.0
    duration_s = 0.0
    basis = "no translational manoeuvre"

    v_mag = float(np.linalg.norm(np.array(snap.v_vec, dtype=float)))

    if "slew_deg" in params:
        # A camera slew is an attitude change; it imparts no translational
        # delta-V at all. Its cost is schedule, not velocity.
        duration_s = max(1.0, params.get("settle_time_s", 0.0))
        basis = "attitude-only slew; no translational delta-V"

    if "burn_dv_mps" in params:
        dv_target = float(params["burn_dv_mps"])
        depth = params.get("target_cone_margin_deg", snap.cone_margin_deg)
        dv_target *= 1.0 + max(0.0, depth - snap.cone_margin_deg) / 20.0
        duration_s = max(1.0, params.get("burn_duration_s", 20.0))
        basis = "CWH cross-track nulling burn"

    if "velocity_clamp_mps" in params:
        clamp = float(params["velocity_clamp_mps"])
        excess = max(0.0, v_mag - clamp) if snap.velocity_observed else 0.0
        hop_dv = float(params.get("standoff_margin_m", 0.0)) * MEAN_MOTION_RAD_S * 2.0
        dv_target = excess + hop_dv
        duration_s = 30.0
        basis = "braking burn for the velocity clamp plus a radial hop for the added standoff"

    if "standoff_m" in params:
        delta_r = abs(float(params["standoff_m"]) - snap.range_m)
        hold = max(30.0, params.get("hold_duration_s", 120.0))
        transfer_dv = 2.0 * delta_r / hold if delta_r > 1e-6 else 0.0
        dv_target = (v_mag if snap.velocity_observed else 0.0) + transfer_dv
        duration_s = hold
        basis = "null the observed closing rate, then translate to the standoff"

    return {
        "dv_target_mps": float(dv_target),
        "duration_s": float(duration_s),
        "basis": basis,
        # Velocity-nulling terms only mean anything once two frames exist.
        "velocity_observed": snap.velocity_observed,
    }


def _monte_carlo_collision(params: Dict[str, float], snap: FlightSnapshot,
                           jg_pred: float, dv_applied: float,
                           horizon_s: float = 600.0,
                           n_mc: int = N_MONTE_CARLO) -> Dict[str, Any]:
    """CWH Monte-Carlo rollout of the post-maneuver relative state.

    Position dispersion comes from the pose model's translational sigma;
    velocity dispersion is driven by the *predicted* Jensen Gain, so tightening
    uncertainty in the wizard genuinely tightens the collision bound.
    """
    # Seed from the actual command so identical inputs reproduce identically
    # while different operator edits give genuinely different ensembles.
    seed = abs(hash((round(jg_pred, 3), round(dv_applied, 5),
                     round(snap.range_m, 3)))) % (2 ** 31)
    rng = np.random.default_rng(seed)

    n = MEAN_MOTION_RAD_S
    r0 = np.array(snap.r_vec, dtype=float)
    v0 = np.array(snap.v_vec, dtype=float)
    v_mag = float(np.linalg.norm(v0))

    # Apply the maneuver: braking/holding pathways shed closing rate, corridor
    # burns redirect it laterally.
    if "velocity_clamp_mps" in params:
        clamp = float(params["velocity_clamp_mps"])
        if v_mag > clamp and v_mag > 1e-9:
            v0 = v0 * (clamp / v_mag)
    if "standoff_m" in params:
        v0 = v0 * 0.02  # station-keeping nulls the relative rate
    if "burn_dv_mps" in params:
        v0 = v0 + np.array([0.0, 1.0, 0.0]) * dv_applied

    sigma_r = max(0.01, snap.sigma_t_m)
    # Angular spread maps to a cross-range rate error at the current range.
    sigma_v = max(1e-5, math.radians(jg_pred) * max(0.5, snap.range_m) / max(60.0, horizon_s))

    standoff_extra = float(params.get("standoff_margin_m", 0.0))
    keepout = KEEPOUT_RADIUS_M + standoff_extra

    states = np.zeros((n_mc, 6))
    states[:, 0:3] = r0 + rng.normal(0.0, sigma_r, size=(n_mc, 3))
    states[:, 3:6] = v0 + rng.normal(0.0, sigma_v, size=(n_mc, 3))

    # 2 s steps: at proximity-ops closing rates a coarser grid can step over
    # the closest-approach point entirely and under-report breaches.
    dt = 2.0
    steps = max(1, int(horizon_s / dt))
    phi = _cwh_state_transition(dt, n)

    min_dist = np.full(n_mc, np.inf)
    trajectory_mean: List[List[float]] = []
    sample_every = max(1, steps // 60)   # ~60 points is plenty to draw
    for step in range(steps):
        states = states @ phi.T
        d = np.linalg.norm(states[:, 0:3], axis=1)
        min_dist = np.minimum(min_dist, d)
        if step % sample_every == 0:
            mean_pos = states[:, 0:3].mean(axis=0)
            trajectory_mean.append([round(float(mean_pos[0]), 4),
                                    round(float(mean_pos[1]), 4),
                                    round(float(mean_pos[2]), 4)])

    breaches = int(np.sum(min_dist < keepout))
    p_hat = breaches / n_mc
    upper = clopper_pearson_upper_bound(breaches, n_mc, confidence=0.99)

    return {
        "n_monte_carlo": n_mc,
        "horizon_s": horizon_s,
        "keepout_radius_m": round(keepout, 3),
        "breach_count": breaches,
        "collision_prob": round(float(p_hat), 5),
        "collision_prob_upper_bound_99": round(float(upper), 5),
        "min_distance_mean_m": round(float(np.mean(min_dist)), 3),
        "min_distance_p05_m": round(float(np.percentile(min_dist, 5)), 3),
        "trajectory_mean": trajectory_mean,
        "sigma_r_m": round(sigma_r, 4),
        "sigma_v_mps": round(sigma_v, 6),
    }


def evaluate_parameters(pathway_id: str, params: Dict[str, float],
                        snap: FlightSnapshot) -> Dict[str, Any]:
    """Full evaluation of one operator-chosen parameter set.

    Everything returned is a function of the pose estimate, the conformal
    uncertainty attached to it, and the orbital dynamics that follow — nothing
    depends on vehicle housekeeping the camera cannot observe.
    """
    specs = parameter_specs_for(pathway_id, snap)
    clean: Dict[str, float] = {}
    for spec in specs:
        raw = params.get(spec.key, spec.default)
        try:
            clean[spec.key] = spec.clamp(float(raw))
        except (TypeError, ValueError):
            clean[spec.key] = spec.default

    jg_pred = _predicted_jensen_gain(pathway_id, clean, snap)
    command = _commanded_delta_v(pathway_id, clean, snap)

    dv_applied = float(command["dv_target_mps"])
    mc = _monte_carlo_collision(clean, snap, jg_pred, dv_applied)

    jg_delta = snap.jensen_gain_deg - jg_pred
    span = snap.jensen_gain_deg - JG_SENSOR_FLOOR_DEG
    confidence_gain_pct = int(np.clip(round(100.0 * jg_delta / span), -100, 100)) if span > 1e-6 else 0

    # Mission success is driven purely by the safety bound: it is the only
    # term the optical chain can actually support.
    mission_success = float(np.clip(1.0 - mc["collision_prob_upper_bound_99"], 0.0, 1.0))

    return {
        "pathway": pathway_id,
        "values": {k: round(v, 6) for k, v in clean.items()},
        "predicted_jensen_gain_deg": jg_pred,
        "jensen_gain_delta_deg": round(float(jg_delta), 2),
        "confidence_gain_pct": confidence_gain_pct,
        "delta_v_mps": round(dv_applied, 5),
        "command_duration_s": round(float(command["duration_s"]), 2),
        "command_basis": command["basis"],
        "velocity_observed": bool(command["velocity_observed"]),
        "collision": mc,
        "mission_success_prob": round(mission_success, 4),
        "resulting_action": _resulting_action(pathway_id, jg_pred, mc, snap),
    }


def _resulting_action(pathway_id: str, jg_pred: float, mc: Dict[str, Any],
                      snap: FlightSnapshot) -> str:
    """Action the vehicle will be commanded into once the maneuver completes."""
    if mc["collision_prob_upper_bound_99"] > COLLISION_BOUND_LIMIT:
        return "hold_position"
    if pathway_id == "station_keeping_recalibrate":
        return "hold_position"
    if jg_pred >= 15.0:
        return "hold_position"
    if jg_pred < 5.0 and snap.range_m > 12.0:
        return "proceed_normal"
    return "proceed_slow"


# ---------------------------------------------------------------------------
# Pre-commit validation — every check is independently computed
# ---------------------------------------------------------------------------
def precommit_checks(evaluation: Dict[str, Any], snap: FlightSnapshot,
                     crew_notified: bool, audit_log_path: str,
                     moderate_thresh_deg: float = 35.0) -> Dict[str, Any]:
    """Four independently computed gates, all observable from the optical chain.

    There is deliberately no propellant or thruster gate here. A monocular
    camera cannot measure tank state, and a gate that always passes because it
    is reading an assumed constant is worse than no gate at all.
    """
    mc = evaluation["collision"]
    bound = float(mc["collision_prob_upper_bound_99"])
    traj_pass = bound <= COLLISION_BOUND_LIMIT

    # Evidence quality: does the manoeuvre actually restore a pose estimate the
    # autonomy is allowed to act on? Threshold comes from JensenGainMonitor.
    jg_pred = float(evaluation["predicted_jensen_gain_deg"])
    evidence_pass = jg_pred < moderate_thresh_deg

    audit = HashChainedLog.verify(audit_log_path)
    audit_pass = bool(audit.get("valid", False))

    checks = [
        {
            "id": "trajectory_cleared",
            "label": "Trajectory Cleared",
            "passed": traj_pass,
            "detail": (
                f"Clopper-Pearson 99% collision upper bound {bound:.2%} "
                f"{'within' if traj_pass else 'EXCEEDS'} the {COLLISION_BOUND_LIMIT:.0%} flight "
                f"limit ({mc['breach_count']}/{mc['n_monte_carlo']} keep-out breaches over a "
                f"{int(mc['horizon_s'])}s CWH Monte-Carlo)."
            ),
            "metric": bound,
            "limit": COLLISION_BOUND_LIMIT,
        },
        {
            "id": "evidence_quality",
            "label": "Optical Evidence",
            "passed": evidence_pass,
            "detail": (
                f"Predicted Jensen Gain {jg_pred:.2f}° "
                f"{'below' if evidence_pass else 'ABOVE'} the {moderate_thresh_deg:.1f}° "
                f"trust threshold, from {snap.jensen_gain_deg:.2f}° now. "
                + ("The pose estimate is usable after this manoeuvre."
                   if evidence_pass else
                   "The pose would remain too ambiguous to act on.")
            ),
            "metric": jg_pred,
            "limit": moderate_thresh_deg,
        },
        {
            "id": "crew_notified",
            "label": "Crew Notified",
            "passed": bool(crew_notified),
            "detail": (
                "Escalation broadcast delivered to the connected mission-control clients."
                if crew_notified else
                "No mission-control client is connected to receive this escalation broadcast."
            ),
            "metric": 1.0 if crew_notified else 0.0,
            "limit": 1.0,
        },
        {
            "id": "audit_integrity",
            "label": "Audit Integrity",
            "passed": audit_pass,
            "detail": (
                f"SHA-256 chain verified across {audit.get('entries_verified', 0)} entries."
                if audit_pass else
                f"Chain verification FAILED at line {audit.get('broken_at_line', '?')}."
            ),
            "metric": float(audit.get("entries_verified", 0)),
            "limit": 0.0,
        },
    ]

    return {
        "checks": checks,
        "all_passed": all(c["passed"] for c in checks),
        "failed": [c["id"] for c in checks if not c["passed"]],
        "audit": audit,
    }


# ---------------------------------------------------------------------------
# Session store — one authoritative countdown per escalation
# ---------------------------------------------------------------------------
@dataclass
class ArmstrongSession:
    session_id: str
    situation_id: str
    level: str
    opened_at: float
    timeout_s: float
    snapshot: FlightSnapshot
    pathways: List[Dict[str, Any]]
    escalation_reason: str
    opened_jensen_gain_deg: float
    committed: bool = False
    committed_at: Optional[float] = None
    selection: Dict[str, Any] = field(default_factory=dict)

    @property
    def deadline_ts(self) -> float:
        return self.opened_at + self.timeout_s

    def remaining_s(self) -> float:
        return max(0.0, self.deadline_ts - time.time())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "situation_id": self.situation_id,
            "level": self.level,
            "opened_at": self.opened_at,
            "timeout_s": self.timeout_s,
            "deadline_ts": self.deadline_ts,
            "remaining_s": round(self.remaining_s(), 2),
            "expired": self.remaining_s() <= 0.0,
            # ArmstrongProtocol._timeout_response always falls back to HOLD_POSITION,
            # never abort — the UI label must say so.
            "timeout_action": "hold_position",
            "timeout_label": "AUTO-HOLD",
            "committed": self.committed,
            "committed_at": self.committed_at,
            "escalation_reason": self.escalation_reason,
            "opened_jensen_gain_deg": self.opened_jensen_gain_deg,
            "snapshot": self.snapshot.to_dict(),
            "pathways": self.pathways,
            "selection": self.selection,
        }


class ArmstrongSessionStore:
    """Thread-safe in-memory store. One live session per wizard entry."""

    #: Flight phase -> countdown, mirroring the Armstrong Protocol fail-quiet rules.
    PHASE_TIMEOUTS = {
        "TERMINAL_BERTH": 60.0,
        "KEEPOUT_PENETRATION": 120.0,
        "CLOSING_GLISSADE": 252.0,
        "FAR_APPROACH": 300.0,
        "AUTONOMOUS_HOLD": 252.0,
        "CAM_ABORT": 60.0,
    }

    def __init__(self):
        self._sessions: Dict[str, ArmstrongSession] = {}
        self._lock = threading.Lock()

    def timeout_for(self, phase: str) -> float:
        return float(self.PHASE_TIMEOUTS.get(phase, 252.0))

    def open(self, level: str, snap: FlightSnapshot,
             pathways: List[Dict[str, Any]]) -> ArmstrongSession:
        session = ArmstrongSession(
            session_id=f"ARM-{uuid.uuid4().hex[:12].upper()}",
            situation_id=snap.situation_id,
            level=level,
            opened_at=time.time(),
            timeout_s=self.timeout_for(snap.flight_phase),
            snapshot=snap,
            pathways=pathways,
            escalation_reason=snap.escalation_reason,
            opened_jensen_gain_deg=snap.jensen_gain_deg,
        )
        with self._lock:
            self._sessions[session.session_id] = session
            # Keep the store bounded; sessions are short-lived by design.
            if len(self._sessions) > 50:
                for s in sorted(self._sessions.values(), key=lambda x: x.opened_at)[:10]:
                    self._sessions.pop(s.session_id, None)
        return session

    def get(self, session_id: str) -> Optional[ArmstrongSession]:
        with self._lock:
            return self._sessions.get(session_id)

    def all(self) -> List[ArmstrongSession]:
        with self._lock:
            return list(self._sessions.values())
