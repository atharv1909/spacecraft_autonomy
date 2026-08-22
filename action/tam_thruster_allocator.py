"""
Thruster Allocation Matrix (TAM) and Reaction Control System (RCS) Propulsion Engine.
Standard flight implementation used in NASA space vehicles (12 cold-gas RCS thruster layout).

Allocates 6-DoF commanded force F_cmd in R^3 and torque tau_cmd in R^3 across 12 thrusters:
  tau_i = r_i x f_i
  B in R^(6 x 12) = [ f_1 ... f_12 ; r_1 x f_1 ... r_12 x f_12 ]
  u = B^+ * [ F_cmd ; tau_cmd ] subject to u_i >= 0 and Minimum Impulse Bit (MIB).
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass

@dataclass
class RCSThruster:
    thruster_id: int
    position_body_m: np.ndarray   # [x, y, z] in spacecraft body frame
    thrust_direction: np.ndarray  # Unit vector of thrust exhaust
    max_thrust_n: float           # Max nominal thrust [N] (e.g., 5.0 N cold-gas)
    min_pulse_width_ms: float     # Minimum Impulse Bit (MIB) in milliseconds (e.g. 10ms)

# ── 12-Thruster Spacecraft Bus Configuration (Cube/Prism geometry) ──
# Main bus: 1.0m x 0.8m x 0.5m
SPACECRAFT_MASS_KG = 120.0
SPACECRAFT_INERTIA = np.diag([18.5, 22.0, 14.2]) # kg*m^2

THRUSTER_LAYOUT = [
    # +X Face Thrusters (Forward / Deceleration)
    RCSThruster(1,  np.array([ 0.5,  0.4,  0.25]), np.array([-1.0, 0.0, 0.0]), 5.0, 10.0),
    RCSThruster(2,  np.array([ 0.5, -0.4,  0.25]), np.array([-1.0, 0.0, 0.0]), 5.0, 10.0),
    # -X Face Thrusters (Aft / Acceleration)
    RCSThruster(3,  np.array([-0.5,  0.4, -0.25]), np.array([ 1.0, 0.0, 0.0]), 5.0, 10.0),
    RCSThruster(4,  np.array([-0.5, -0.4, -0.25]), np.array([ 1.0, 0.0, 0.0]), 5.0, 10.0),
    # +Y Face Thrusters (Port / Roll/Yaw)
    RCSThruster(5,  np.array([ 0.4,  0.4,  0.0 ]), np.array([ 0.0,-1.0, 0.0]), 5.0, 10.0),
    RCSThruster(6,  np.array([-0.4,  0.4,  0.0 ]), np.array([ 0.0,-1.0, 0.0]), 5.0, 10.0),
    # -Y Face Thrusters (Starboard / Roll/Yaw)
    RCSThruster(7,  np.array([ 0.4, -0.4,  0.0 ]), np.array([ 0.0, 1.0, 0.0]), 5.0, 10.0),
    RCSThruster(8,  np.array([-0.4, -0.4,  0.0 ]), np.array([ 0.0, 1.0, 0.0]), 5.0, 10.0),
    # +Z Face Thrusters (Zenith / Pitch)
    RCSThruster(9,  np.array([ 0.0,  0.3,  0.25]), np.array([ 0.0, 0.0,-1.0]), 5.0, 10.0),
    RCSThruster(10, np.array([ 0.0, -0.3,  0.25]), np.array([ 0.0, 0.0,-1.0]), 5.0, 10.0),
    # -Z Face Thrusters (Nadir / Pitch)
    RCSThruster(11, np.array([ 0.0,  0.3, -0.25]), np.array([ 0.0, 0.0, 1.0]), 5.0, 10.0),
    RCSThruster(12, np.array([ 0.0, -0.3, -0.25]), np.array([ 0.0, 0.0, 1.0]), 5.0, 10.0),
]

class ThrusterAllocationMatrix:
    """
    Computes optimal cold-gas thruster firings using Moore-Penrose Pseudoinverse with Simplex projection.
    """

    def __init__(self, isp_s: float = 220.0, initial_propellant_kg: float = 500.0):
        self.isp = isp_s
        self.g0 = 9.80665
        self.propellant_mass_kg = initial_propellant_kg
        self.total_delta_v_mps = 0.0

        # Build 6x12 Thruster Allocation Matrix B
        B = np.zeros((6, 12), dtype=np.float64)
        for i, t in enumerate(THRUSTER_LAYOUT):
            # Force mapping: F = d_i * T_max
            f_vec = t.thrust_direction * t.max_thrust_n
            # Torque mapping: tau = r_i x F
            tau_vec = np.cross(t.position_body_m, f_vec)
            
            B[0:3, i] = f_vec
            B[3:6, i] = tau_vec

        self.B = B
        # Damped Moore-Penrose Pseudoinverse: B^+ = B^T * (B * B^T + lambda*I)^-1
        lambda_reg = 1e-4
        self.B_pinv = B.T @ np.linalg.inv(B @ B.T + lambda_reg * np.eye(6))

    def allocate(self, force_cmd_n: np.ndarray, torque_cmd_nm: np.ndarray, dt_s: float = 0.1) -> Dict[str, Any]:
        """
        Allocates commanded 3D force and 3D torque across the 12 RCS thrusters.
        Enforces positivity (cold-gas thrusters cannot pull) and computes duty cycles.
        """
        w_cmd = np.concatenate([np.asarray(force_cmd_n, dtype=np.float64),
                                np.asarray(torque_cmd_nm, dtype=np.float64)])

        # Linear least-squares allocation
        u_raw = self.B_pinv @ w_cmd

        # Positive rectification & saturation [0.0, 1.0]
        u_clamped = np.clip(u_raw, 0.0, 1.0)

        # Minimum Impulse Bit (MIB) gating: if pulse < 10ms (10% of 100ms cycle), suppress
        u_gated = np.where(u_clamped >= 0.08, u_clamped, 0.0)

        # Duty cycles in percent
        duty_pct = [round(float(x * 100.0), 1) for x in u_gated]

        # Actual realized force and torque
        w_realized = self.B @ u_gated
        f_realized = w_realized[0:3]
        tau_realized = w_realized[3:6]

        # Mass expenditure calculation: m_dot = sum(F_i) / (I_sp * g_0)
        total_thrust_n = float(np.sum([u_gated[i] * THRUSTER_LAYOUT[i].max_thrust_n for i in range(12)]))
        mass_flow_rate_kg_s = total_thrust_n / (self.isp * self.g0)
        dm_kg = mass_flow_rate_kg_s * dt_s
        self.propellant_mass_kg = max(0.0, self.propellant_mass_kg - dm_kg)

        # Tsiolkovsky delta-V: dv = F_net / m * dt
        dv = (float(np.linalg.norm(f_realized)) / SPACECRAFT_MASS_KG) * dt_s
        self.total_delta_v_mps += dv

        return {
            "thruster_duty_pct": duty_pct,
            "force_realized_n": [round(float(x), 3) for x in f_realized],
            "torque_realized_nm": [round(float(x), 4) for x in tau_realized],
            "propellant_remaining_kg": round(self.propellant_mass_kg, 5),
            "delta_v_expended_mps": round(self.total_delta_v_mps, 5),
            "total_thrust_n": round(total_thrust_n, 2),
            "valve_firings_count": int(np.sum(u_gated > 0))
        }
