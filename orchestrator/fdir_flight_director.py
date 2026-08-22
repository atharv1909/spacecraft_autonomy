"""
NASA Fault Detection, Isolation, and Recovery (FDIR) Autonomous Flight Director.
Manages mission phase state transitions, safety corridors, and automated Collision Avoidance Maneuvers (CAM).
"""

import numpy as np
from enum import Enum
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass

class FlightPhase(str, Enum):
    FAR_APPROACH = "FAR_APPROACH"               # R > 50m
    CLOSING_GLISSADE = "CLOSING_GLISSADE"       # 50m >= R > 10m
    KEEPOUT_PENETRATION = "KEEPOUT_PENETRATION" # 10m >= R > 2m (Inside KOZ)
    TERMINAL_BERTH = "TERMINAL_BERTH"           # R <= 2m (Soft-dock latch)
    AUTONOMOUS_HOLD = "AUTONOMOUS_HOLD"         # Station-keeping safety mode
    CAM_ABORT = "CAM_ABORT"                     # Active Collision Avoidance Maneuver

@dataclass
class FDIRSafetyStatus:
    phase: FlightPhase
    in_approach_cone: bool
    cone_margin_deg: float
    range_m: float
    range_rate_mps: float
    max_safe_velocity_mps: float
    tripwire_triggered: bool
    tripwire_reason: str
    commanded_mode: str
    cam_delta_v_mps: List[float]

class NASAAutonomousFlightDirector:
    """
    Manages autonomous proximity operations safety rules based on NASA / ESA RPO standards.
    """

    def __init__(self, cone_half_angle_deg: float = 20.0, koz_radius_m: float = 10.0):
        self.cone_half_angle = cone_half_angle_deg
        self.koz_radius = koz_radius_m
        self.current_phase = FlightPhase.FAR_APPROACH
        self.consecutive_bad_frames = 0
        self.cam_executed = False

    def evaluate_safety_step(self, r_vec: np.ndarray, v_vec: np.ndarray,
                             jensen_gain_deg: float, is_trustworthy: bool) -> FDIRSafetyStatus:
        """
        Evaluates real-time flight safety gates and transitions flight phases.
        """
        r_vec = np.asarray(r_vec, dtype=float)
        v_vec = np.asarray(v_vec, dtype=float)
        range_m = float(np.linalg.norm(r_vec))
        range_rate = float(np.linalg.norm(v_vec))

        # 1. 20° LOS Approach Cone Angle Verification
        # Centerline is along +X axis (docking port normal)
        r_transverse = float(np.sqrt(r_vec[1]**2 + r_vec[2]**2))
        off_axis_angle_deg = float(np.degrees(np.arctan2(r_transverse, max(0.1, abs(r_vec[0])))))
        cone_margin = self.cone_half_angle - off_axis_angle_deg
        in_cone = cone_margin > 0.0

        # 2. Maximum Safe Approach Velocity Envelope: v_max = sqrt(2 * a_dec * (r - r_dock))
        a_dec = 0.04 # m/s^2 deceleration budget
        v_max = float(np.sqrt(2.0 * a_dec * max(0.05, range_m - 0.48)))

        # 3. Bad frames accumulator (sensor blinding / high uncertainty)
        if not is_trustworthy or jensen_gain_deg >= 15.0:
            self.consecutive_bad_frames += 1
        else:
            self.consecutive_bad_frames = max(0, self.consecutive_bad_frames - 1)

        # 4. Tripwire Evaluation
        tripwire = False
        reason = "Nominal Flight Corridor"
        cam_dv = [0.0, 0.0, 0.0]

        if not in_cone and range_m < self.koz_radius:
            tripwire = True
            reason = f"TRIPWIRE: Approach cone exceeded ({off_axis_angle_deg:.1f}° > {self.cone_half_angle}°) inside KOZ. CAM armed."
            self.current_phase = FlightPhase.CAM_ABORT
            # Radial-out + V-bar retarding CAM burn: Delta-V = [+0.5 m/s Radial, -0.2 m/s Along-track]
            cam_dv = [0.0, 0.5, 0.0]
        elif range_rate > v_max * 1.35 and range_m > 2.0:
            tripwire = True
            reason = f"TRIPWIRE: Range-rate overspeed ({range_rate:.2f} m/s > {v_max:.2f} m/s limit). Enforcing reverse braking."
            self.current_phase = FlightPhase.AUTONOMOUS_HOLD
        elif self.consecutive_bad_frames >= 2:
            tripwire = True
            reason = f"TRIPWIRE: Persistent sensor uncertainty (Jensen Gain {jensen_gain_deg:.1f}°). Holding station."
            self.current_phase = FlightPhase.AUTONOMOUS_HOLD
        else:
            # Nominal Phase Transitions
            if range_m > 50.0:
                self.current_phase = FlightPhase.FAR_APPROACH
            elif range_m > self.koz_radius:
                self.current_phase = FlightPhase.CLOSING_GLISSADE
            elif range_m > 2.0:
                self.current_phase = FlightPhase.KEEPOUT_PENETRATION
            else:
                self.current_phase = FlightPhase.TERMINAL_BERTH

        cmd_mode = "HOLD_POSITION" if tripwire else ("PROCEED_SLOW" if range_m < 15.0 else "PROCEED_NORMAL")

        return FDIRSafetyStatus(
            phase=self.current_phase,
            in_approach_cone=in_cone,
            cone_margin_deg=round(cone_margin, 2),
            range_m=round(range_m, 3),
            range_rate_mps=round(range_rate, 3),
            max_safe_velocity_mps=round(v_max, 3),
            tripwire_triggered=tripwire,
            tripwire_reason=reason,
            commanded_mode=cmd_mode,
            cam_delta_v_mps=cam_dv
        )
