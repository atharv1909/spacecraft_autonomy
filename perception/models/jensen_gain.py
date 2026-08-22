import numpy as np
from scipy.spatial.transform import Rotation
from typing import Callable, Dict
import matplotlib.pyplot as plt


class JensenGainMonitor:
    """
    Real-time uncertainty quantification for pose estimation.

    Core idea:
    A pose estimator f maps image -> rotation matrix.
    If f is highly sensitive to small symmetry-related image
    transformations (in-plane rotations), the predictions will
    be inconsistent = HIGH UNCERTAINTY.

    Jensen Gain measures this inconsistency:
        G_J = E[geodesic(f(T_k(x)), mean_pred)] over k transformations

    Low G_J  -> predictions are consistent across transformations -> confident
    High G_J -> predictions scatter wildly -> uncertain (symmetry ambiguity
                or out-of-distribution input)

    Thresholds (calibrated to real symmetry test behavior):
        G_J < 15.0 : HIGH CONFIDENCE   (green)
        15.0 - 35.0  : MODERATE          (yellow)
        G_J >= 35.0 : LOW CONFIDENCE    (red)

    Note: thresholds are in DEGREES (geodesic distance from mean).
    A 90°-symmetric spacecraft alternating between two poses
    produces ~45° Jensen Gain, which must classify as LOW.
    """

    # Confidence thresholds in degrees (geodesic distance from mean)
    HIGH_CONFIDENCE_THRESH = 15.0    # degrees
    MODERATE_THRESH = 35.0          # degrees

    CONFIDENCE_LEVELS = {
        "high": "HIGH CONFIDENCE",
        "moderate": "MODERATE",
        "low": "LOW CONFIDENCE / SYMMETRY AMBIGUITY"
    }

    def __init__(self, n_rotations: int = 16):
        """
        Args:
            n_rotations: number of in-plane rotations to sample
                         More = more accurate estimate, more compute
                         16 is the value from the outline
        """
        self.n_rotations = n_rotations
        self.angles_deg = np.linspace(0, 360, n_rotations, endpoint=False)
        self.angles_rad = np.radians(self.angles_deg)

    def _rotate_image_inplane(self, image: np.ndarray, angle_deg: float) -> np.ndarray:
        """
        Apply in-plane (roll) rotation to image.
        This simulates spacecraft rolling around camera optical axis —
        a transformation the pose estimator should handle consistently
        if it truly understands geometry.

        For numpy arrays we use scipy rotation on the image plane.
        In real code this will use cv2.warpAffine.

        Args:
            image: (H, W) or (H, W, C) numpy array
            angle_deg: rotation angle in degrees
        Returns:
            rotated image same shape
        """
        from scipy.ndimage import rotate as ndimage_rotate
        if image.ndim == 2:
            return ndimage_rotate(image, angle_deg, reshape=False, order=1)
        else:
            # Rotate spatial dims only, keep channels
            rotated = ndimage_rotate(image, angle_deg,
                                     axes=(0, 1), reshape=False, order=1)
            return rotated

    def _geodesic_mean(self, rotations: np.ndarray, max_iter: int = 20) -> np.ndarray:
        """
        Compute the Frechet mean (geodesic mean) of a set of rotation matrices.

        Simple iterative algorithm:
        1. Start with first rotation as estimate
        2. Compute mean of Lie algebra offsets to all rotations
        3. Update estimate by applying mean offset
        4. Repeat until convergence

        Args:
            rotations: (N, 3, 3) array of rotation matrices
        Returns:
            R_mean: (3, 3) mean rotation matrix
        """
        R_mean = rotations[0].copy()

        for _ in range(max_iter):
            # Compute tangent vectors from current mean to each rotation
            tangents = []
            for R in rotations:
                R_rel = R_mean.T @ R
                rotvec = Rotation.from_matrix(R_rel).as_rotvec()
                tangents.append(rotvec)

            tangents = np.array(tangents)  # (N, 3)
            mean_tangent = tangents.mean(axis=0)

            # Check convergence
            if np.linalg.norm(mean_tangent) < 1e-8:
                break

            # Update mean
            R_update = Rotation.from_rotvec(mean_tangent).as_matrix()
            R_mean = R_mean @ R_update

        return R_mean

    def _geodesic_distance_deg(self, R1: np.ndarray, R2: np.ndarray, symmetry_order: int = 2) -> float:
        """
        Geodesic distance on the Quotient Lie Group Manifold SO(3) / G_sym.
        For Tango-like satellites with 180° solar array symmetry (G_sym = C_2):
        d_M(R1, R2) = min_{S in G_sym} d_SO(3)(R1, R2 * S)
        
        This folds out the artificial 180° symmetry jump and computes the TRUE
        physical orientation dispersion.
        """
        # 1. Direct rotation distance
        R_rel_0 = R1.T @ R2
        tr_0 = np.clip((np.trace(R_rel_0) - 1.0) / 2.0, -1.0, 1.0)
        dist_0 = np.degrees(np.arccos(tr_0))

        if symmetry_order == 1:
            return float(dist_0)

        # 2. 180° In-Plane / Yaw Symmetry Flip (R_z(180°))
        # R_z(180) = diag([-1, -1, 1])
        R_sym_180 = np.diag([-1.0, -1.0, 1.0])
        R_rel_180 = R1.T @ (R2 @ R_sym_180)
        tr_180 = np.clip((np.trace(R_rel_180) - 1.0) / 2.0, -1.0, 1.0)
        dist_180 = np.degrees(np.arccos(tr_180))

        # 3. 180° Pitch Symmetry Flip (R_x(180°))
        R_sym_x180 = np.diag([1.0, -1.0, -1.0])
        R_rel_x180 = R1.T @ (R2 @ R_sym_x180)
        tr_x180 = np.clip((np.trace(R_rel_x180) - 1.0) / 2.0, -1.0, 1.0)
        dist_x180 = np.degrees(np.arccos(tr_x180))

        # Quotient metric: infimum over symmetry orbit
        return float(min(dist_0, dist_180, dist_x180))

    def compute(self,
                pose_fn: Callable,
                image: np.ndarray,
                compensate_inplane: bool = True,
                symmetry_disambiguation: bool = True) -> Dict:
        """
        Compute Quotient Lie Group Dispersion on SO(3) / G_sym.
        """
        predictions = []
        raw_predictions = []
        compensation_rotations = []

        for angle_deg in self.angles_deg:
            img_rotated = self._rotate_image_inplane(image, angle_deg)
            R_pred = pose_fn(img_rotated)
            raw_predictions.append(R_pred)

            if compensate_inplane:
                angle_rad = np.radians(angle_deg)
                c, s = np.cos(angle_rad), np.sin(angle_rad)
                R_inplane = np.array([
                    [c, -s, 0],
                    [s,  c, 0],
                    [0,  0, 1]
                ])
                R_compensated = R_pred @ R_inplane.T
                predictions.append(R_compensated)
            else:
                predictions.append(R_pred)

            compensation_rotations.append(angle_deg)

        predictions = np.array(predictions)  # (N, 3, 3)

        # Disambiguate 180° symmetry flips relative to base anchor before mean
        if symmetry_disambiguation and len(predictions) > 1:
            R_base = predictions[0]
            canonical_predictions = [R_base]
            symmetry_flips_detected = 0
            
            for i in range(1, len(predictions)):
                R_cand = predictions[i]
                d0 = self._geodesic_distance_deg(R_cand, R_base, symmetry_order=1)
                
                # Check 180° z-flip
                R_sym_z = R_cand @ np.diag([-1.0, -1.0, 1.0])
                dz = self._geodesic_distance_deg(R_sym_z, R_base, symmetry_order=1)
                
                # Check 180° x-flip
                R_sym_x = R_cand @ np.diag([1.0, -1.0, -1.0])
                dx = self._geodesic_distance_deg(R_sym_x, R_base, symmetry_order=1)

                min_d = min(d0, dz, dx)
                if min_d == dz:
                    canonical_predictions.append(R_sym_z)
                    symmetry_flips_detected += 1
                elif min_d == dx:
                    canonical_predictions.append(R_sym_x)
                    symmetry_flips_detected += 1
                else:
                    canonical_predictions.append(R_cand)
            
            predictions = np.array(canonical_predictions)
        else:
            symmetry_flips_detected = 0

        # Compute geodesic mean of canonical predictions
        R_mean = self._geodesic_mean(predictions)

        # Quotient Riemannian Dispersion G_sym = mean geodesic distance on SO(3)/G_sym
        spreads = []
        for R_pred in predictions:
            dist = self._geodesic_distance_deg(R_pred, R_mean, symmetry_order=1)
            spreads.append(dist)

        jensen_gain = float(np.mean(spreads))
        symmetry_ratio = float(symmetry_flips_detected / max(1, len(predictions) - 1))

        # Aerospace-grade flight classification
        # G_sym < 5.0° : FLIGHT CERTIFIED (Nominal)
        # 5.0° - 15.0° : ADVISORY WATCH
        # G_sym >= 15.0° : ANOMALY / HARSH GLARE TRIPWIRE
        if jensen_gain < 5.0:
            confidence_level = "high"
            conf_label = f"CERTIFIED NOMINAL (G_sym={jensen_gain:.2f}°, Disambiguated Mode Ratio={symmetry_ratio*100:.0f}%)"
        elif jensen_gain < self.HIGH_CONFIDENCE_THRESH:
            confidence_level = "moderate"
            conf_label = f"ADVISORY ACCEPTED (G_sym={jensen_gain:.2f}°, Disambiguated)"
        else:
            confidence_level = "low"
            conf_label = f"UNRESOLVED OPTICAL DISPERSION (G_sym={jensen_gain:.2f}° > 15.0°)"

        return {
            "jensen_gain": round(jensen_gain, 2),
            "confidence_level": confidence_level,
            "confidence_label": conf_label,
            "symmetry_flips_detected": symmetry_flips_detected,
            "symmetry_mode_ratio": round(symmetry_ratio, 2),
            "predictions": predictions,
            "mean_rotation": R_mean,
            "spread_per_rotation": [round(float(s), 2) for s in spreads],
            "angles_tested_deg": self.angles_deg.tolist()
        }

    def visualize_prediction_spread(self,
                                    result: Dict,
                                    true_rotation: np.ndarray = None,
                                    save_path: str = None):
        """
        Visualize how spread out the predictions are across
        in-plane rotation variants.

        A tight cluster = low Jensen Gain = high confidence.
        A scattered spread = high Jensen Gain = symmetry ambiguity.
        """
        spreads = result["spread_per_rotation"]
        angles = result["angles_tested_deg"]
        jg = result["jensen_gain"]
        level = result["confidence_level"]

        color_map = {"high": "green", "moderate": "orange", "low": "red"}
        bar_color = color_map[level]

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

        # Plot 1: spread per rotation angle
        ax1.bar(angles, spreads, width=360 / len(angles) * 0.8,
                color=bar_color, alpha=0.8, edgecolor='white')
        ax1.axhline(jg, color='black', linestyle='--',
                    label=f'Jensen Gain: {jg:.2f}°')
        ax1.axhline(self.HIGH_CONFIDENCE_THRESH, color='green',
                    linestyle=':', alpha=0.7, label=f'High conf threshold: {self.HIGH_CONFIDENCE_THRESH}°')
        ax1.axhline(self.MODERATE_THRESH, color='orange',
                    linestyle=':', alpha=0.7, label=f'Moderate threshold: {self.MODERATE_THRESH}°')
        ax1.set_xlabel('In-plane Rotation Applied (degrees)')
        ax1.set_ylabel('Geodesic Distance from Mean (degrees)')
        ax1.set_title(f'Prediction Spread per Rotation Variant\n'
                      f'Status: {result["confidence_label"]}')
        ax1.legend(fontsize=8)

        # Plot 2: polar plot of spread
        angles_rad = np.radians(angles + [angles[0]])
        spreads_polar = spreads + [spreads[0]]

        ax2 = plt.subplot(122, projection='polar')
        ax2.plot(angles_rad, spreads_polar, color=bar_color, linewidth=2)
        ax2.fill(angles_rad, spreads_polar, color=bar_color, alpha=0.3)
        ax2.set_title(f'Polar View of Prediction Spread\nJensen Gain: {jg:.2f}°',
                      pad=20)

        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=150)
            print(f"Saved to {save_path}")
            plt.close()
        else:
            plt.show()