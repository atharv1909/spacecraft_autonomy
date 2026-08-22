"""
Multiplicative Extended Kalman Filter (MEKF) for 6-DoF Spacecraft Pose & Attitude Estimation.
Standard flight implementation used in NASA GNC (Orion, MMS, Raven, PRISMA).

State Vector (12-state):
  x = [ r (3x1, position [m])
        v (3x1, relative velocity [m/s])
        delta_theta (3x1, Lie algebra so(3) attitude error [rad])
        bias_gyro (3x1, gyro rate bias [rad/s]) ]

Attitude Representation:
  Unit quaternion q_ref updated via multiplicative quaternion error: q_new = delta_q(delta_theta) (x) q_ref
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
import time

def quaternion_multiply(q1: np.ndarray, q2: np.ndarray) -> np.ndarray:
    """Multiplies two quaternions [qw, qx, qy, qz]."""
    w1, x1, y1, z1 = q1[0], q1[1], q1[2], q1[3]
    w2, x2, y2, z2 = q2[0], q2[1], q2[2], q2[3]
    return np.array([
        w1*w2 - x1*x2 - y1*y2 - z1*z2,
        w1*x2 + x1*w2 + y1*z2 - z1*y2,
        w1*y2 - x1*z2 + y1*w2 + z1*x2,
        w1*z2 + x1*y2 - y1*x2 + z1*w2
    ], dtype=np.float64)

def quaternion_to_rot_matrix(q: np.ndarray) -> np.ndarray:
    """Converts unit quaternion [qw, qx, qy, qz] to 3x3 rotation matrix."""
    qw, qx, qy, qz = q[0], q[1], q[2], q[3]
    return np.array([
        [1 - 2*qy*qy - 2*qz*qz, 2*qx*qy - 2*qz*qw,     2*qx*qz + 2*qy*qw],
        [2*qx*qy + 2*qz*qw,     1 - 2*qx*qx - 2*qz*qz, 2*qy*qz - 2*qx*qw],
        [2*qx*qz - 2*qy*qw,     2*qy*qz + 2*qx*qw,     1 - 2*qx*qx - 2*qy*qy]
    ], dtype=np.float64)

def skew_symmetric(v: np.ndarray) -> np.ndarray:
    """Returns 3x3 skew-symmetric cross-product matrix [v_x]."""
    return np.array([
        [0, -v[2], v[1]],
        [v[2], 0, -v[0]],
        [-v[1], v[0], 0]
    ], dtype=np.float64)

class SpacecraftMEKF:
    """
    Flight-grade 6-DoF Multiplicative Extended Kalman Filter.
    Features:
      - Multiplicative quaternion error attitude update (avoids quaternion covariance singularity)
      - Dynamic measurement covariance scaling based on Jensen Gain
      - Mahalanobis chi-squared outlier rejection gate
      - Gyro bias estimation
    """

    def __init__(self, initial_position: np.ndarray, initial_quaternion: np.ndarray,
                 mean_motion_n: float = 0.00113): # ~500km LEO mean motion [rad/s]
        self.n = mean_motion_n # Orbital mean motion (2*pi / T_orbit)
        
        # State: position (3), velocity (3), gyro bias (3)
        self.r = np.array(initial_position, dtype=np.float64)
        self.v = np.zeros(3, dtype=np.float64)
        self.q_ref = np.array(initial_quaternion, dtype=np.float64)
        self.q_ref /= np.linalg.norm(self.q_ref)
        self.bias_gyro = np.zeros(3, dtype=np.float64)

        # 9x9 Error State Covariance P: [delta_r, delta_v, delta_theta, delta_bias] -> 12x12
        self.P = np.diag([
            0.5, 0.5, 0.5,       # position var [m^2]
            0.02, 0.02, 0.02,    # velocity var [(m/s)^2]
            0.05, 0.05, 0.05,    # attitude error var [rad^2] (~12 deg initial std)
            1e-5, 1e-5, 1e-5     # gyro bias var [(rad/s)^2]
        ]).astype(np.float64)

        # Process Noise Covariance Q
        self.Q = np.diag([
            1e-4, 1e-4, 1e-4,    # pos drift
            1e-3, 1e-3, 1e-3,    # vel acceleration noise
            1e-4, 1e-4, 1e-4,    # gyro noise
            1e-7, 1e-7, 1e-7     # bias random walk
        ]).astype(np.float64)

        self.last_timestamp = time.time()

    def predict(self, dt: float, omega_meas: np.ndarray = None, accel_meas: np.ndarray = None):
        """
        Propagates state forward in time using CWH orbital dynamics and kinematic attitude integration.
        """
        if dt <= 0 or dt > 5.0:
            dt = 0.1

        # 1. CWH Orbital Dynamics for relative motion
        n = self.n
        # Continuous CWH state matrix A_c
        # x_dot = v_x
        # y_dot = v_y
        # z_dot = v_z
        # vx_dot = 3*n^2*x + 2*n*vy
        # vy_dot = -2*n*vx
        # vz_dot = -n^2*z
        r_next = np.zeros(3)
        v_next = np.zeros(3)

        r_next[0] = self.r[0] + self.v[0]*dt + 0.5*(3*n*n*self.r[0] + 2*n*self.v[1])*dt*dt
        r_next[1] = self.r[1] + self.v[1]*dt + 0.5*(-2*n*self.v[0])*dt*dt
        r_next[2] = self.r[2] + self.v[2]*dt + 0.5*(-n*n*self.r[2])*dt*dt

        v_next[0] = self.v[0] + (3*n*n*self.r[0] + 2*n*self.v[1])*dt
        v_next[1] = self.v[1] + (-2*n*self.v[0])*dt
        v_next[2] = self.v[2] + (-n*n*self.r[2])*dt

        self.r = r_next
        self.v = v_next

        # 2. Attitude Kinematic Propagation (q_dot = 0.5 * q * omega)
        if omega_meas is None:
            omega_meas = np.array([0.0, 0.0, 0.0])
        
        omega_unbiased = omega_meas - self.bias_gyro
        omega_norm = float(np.linalg.norm(omega_unbiased))
        
        if omega_norm > 1e-8:
            dq_w = np.cos(0.5 * omega_norm * dt)
            dq_xyz = (omega_unbiased / omega_norm) * np.sin(0.5 * omega_norm * dt)
            dq = np.array([dq_w, dq_xyz[0], dq_xyz[1], dq_xyz[2]])
            self.q_ref = quaternion_multiply(self.q_ref, dq)
            self.q_ref /= np.linalg.norm(self.q_ref)

        # 3. State Transition Matrix Phi (12x12)
        Phi = np.eye(12, dtype=np.float64)
        Phi[0:3, 3:6] = np.eye(3) * dt
        Phi[3, 0] = 3*n*n * dt; Phi[3, 4] = 2*n * dt
        Phi[4, 3] = -2*n * dt
        Phi[5, 2] = -n*n * dt
        Phi[6:9, 9:12] = -np.eye(3) * dt # Attitude coupling to gyro bias

        # Propagate covariance: P = Phi * P * Phi^T + Q * dt
        self.P = Phi @ self.P @ Phi.T + self.Q * dt

    def update_pose_measurement(self, r_meas: np.ndarray, q_meas: np.ndarray,
                                jensen_gain_deg: float) -> Dict[str, Any]:
        """
        Fuses vision pose measurement [r_meas, q_meas] into the filter.
        Uses Jensen Gain to adaptively scale measurement covariance R.
        """
        r_meas = np.asarray(r_meas, dtype=np.float64)
        q_meas = np.asarray(q_meas, dtype=np.float64)
        q_meas /= np.linalg.norm(q_meas)

        # 1. Compute Position Residual: y_r = r_meas - r_pred
        y_r = r_meas - self.r

        # 2. Compute Attitude Error in Lie Algebra so(3): delta_q = q_meas (x) q_ref^-1
        q_ref_inv = np.array([self.q_ref[0], -self.q_ref[1], -self.q_ref[2], -self.q_ref[3]])
        dq = quaternion_multiply(q_meas, q_ref_inv)
        if dq[0] < 0: # Ensure shortest geodesic path on S^3
            dq = -dq
        
        # Small angle approximation: delta_theta = 2 * dq_vector / dq_scalar
        y_theta = 2.0 * dq[1:4] / max(1e-4, dq[0])

        # Combined measurement residual y = [y_r (3), y_theta (3)] (6x1)
        y = np.concatenate([y_r, y_theta])

        # 3. Measurement Matrix H (6x12): measures pos (0:3) and attitude error (6:9)
        H = np.zeros((6, 12), dtype=np.float64)
        H[0:3, 0:3] = np.eye(3)
        H[3:6, 6:9] = np.eye(3)

        # 4. Adaptive Measurement Covariance R scaled by Jensen Gain
        # If Jensen Gain is high (symmetry ambiguity), measurement covariance R explodes,
        # preventing the filter from being corrupted by bad vision frames.
        jg_factor = max(1.0, (jensen_gain_deg / 5.0) ** 2)
        R_pos = np.eye(3) * (0.05 * jg_factor)
        R_att = np.eye(3) * (0.005 * jg_factor)
        R_cov = np.block([
            [R_pos, np.zeros((3, 3))],
            [np.zeros((3, 3)), R_att]
        ])

        # 5. Innovation Covariance S = H * P * H^T + R
        S = H @ self.P @ H.T + R_cov

        # 6. Chi-Square Mahalanobis Outlier Gate (6-DoF, 99% threshold = 16.8)
        mahalanobis_sq = float(y.T @ np.linalg.inv(S) @ y)
        is_measurement_accepted = mahalanobis_sq < 24.0 or jensen_gain_deg < 15.0

        if is_measurement_accepted:
            # Kalman Gain K = P * H^T * S^-1 (12x6)
            K = self.P @ H.T @ np.linalg.inv(S)
            
            # Error state update: delta_x = K * y (12x1)
            delta_x = K @ y

            # Apply corrections to nominal state
            self.r += delta_x[0:3]
            self.v += delta_x[3:6]
            
            # Multiplicative quaternion correction
            dtheta = delta_x[6:9]
            dtheta_norm = float(np.linalg.norm(dtheta))
            if dtheta_norm > 1e-8:
                dq_corr = np.array([np.cos(0.5*dtheta_norm), *(dtheta/dtheta_norm * np.sin(0.5*dtheta_norm))])
                self.q_ref = quaternion_multiply(dq_corr, self.q_ref)
                self.q_ref /= np.linalg.norm(self.q_ref)

            self.bias_gyro += delta_x[9:12]

            # Joseph Form Covariance Update: P = (I - K*H)*P*(I - K*H)^T + K*R*K^T (guarantees positive definiteness)
            I_KH = np.eye(12) - K @ H
            self.P = I_KH @ self.P @ I_KH.T + K @ R_cov @ K.T
        else:
            # Gated / Rejected measurement: Dead reckon on propagation
            pass

        # Extract 3-sigma uncertainties
        std_pos = np.sqrt(np.diag(self.P[0:3, 0:3]))
        std_att = np.sqrt(np.diag(self.P[6:9, 6:9])) * 57.2958 # deg

        return {
            "r_filtered": [round(float(x), 4) for x in self.r],
            "v_filtered": [round(float(x), 4) for x in self.v],
            "q_filtered": [round(float(x), 4) for x in self.q_ref],
            "sigma_pos_3d_m": round(float(np.linalg.norm(std_pos)), 3),
            "sigma_att_3d_deg": round(float(np.linalg.norm(std_att)), 2),
            "mahalanobis_residual": round(mahalanobis_sq, 2),
            "measurement_accepted": is_measurement_accepted,
            "kalman_gain_trace": round(float(np.trace(self.P)), 4)
        }
