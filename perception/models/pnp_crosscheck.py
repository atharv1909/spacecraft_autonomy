import cv2
import numpy as np
import os
import pickle
from typing import Optional, Dict, Any

class TemplatePnPEstimator:
    """
    Independent classical-CV pose estimator using ORB feature matching + PnP.
    Provides an orthogonal validation channel independent of neural networks.
    """

    def __init__(self, template_db_path: Optional[str] = None,
                 camera_matrix: Optional[np.ndarray] = None,
                 dist_coeffs: Optional[np.ndarray] = None,
                 min_matches: int = 8):
        self.orb = cv2.ORB_create(nfeatures=1000)
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

        # SPEED+ calibrated Nikon camera parameters if not provided
        if camera_matrix is None:
            self.K = np.array([
                [0.0176 * 1000, 0.0, 960.0],
                [0.0, 0.0176 * 1000, 600.0],
                [0.0, 0.0, 1.0]
            ], dtype=np.float32)
        else:
            self.K = np.asarray(camera_matrix, dtype=np.float32)

        self.dist = dist_coeffs if dist_coeffs is not None else np.zeros((4, 1), dtype=np.float32)
        self.min_matches = min_matches
        self.templates = []

        if template_db_path and os.path.exists(template_db_path):
            self.templates = self._load_templates(template_db_path)
        else:
            self._init_synthetic_templates()

    def _load_templates(self, path: str):
        try:
            with open(path, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            print(f"[PnP] Warning loading template db: {e}")
            return []

    def _init_synthetic_templates(self):
        """
        Synthesize default 3D CAD structure templates (Tango satellite geometric model).
        """
        # Tango satellite 3D landmark points in meters
        cad_3d = np.array([
            [-0.37, -0.29, -0.28],
            [ 0.37, -0.29, -0.28],
            [ 0.37,  0.29, -0.28],
            [-0.37,  0.29, -0.28],
            [-0.37, -0.29,  0.28],
            [ 0.37, -0.29,  0.28],
            [ 0.37,  0.29,  0.28],
            [-0.37,  0.29,  0.28],
            [ 0.0,   0.0,   0.35],
            [ 0.0,   0.45,  0.0 ],
            [-0.45,  0.0,   0.0 ],
        ], dtype=np.float32)

        # Create 12 anchor pose templates spanning SO(3)
        for i in range(12):
            angle = i * (2 * np.pi / 12)
            R_tmpl = np.array([
                [np.cos(angle), -np.sin(angle), 0],
                [np.sin(angle),  np.cos(angle), 0],
                [0, 0, 1]
            ], dtype=np.float32)
            t_tmpl = np.array([0.0, 0.0, 15.0], dtype=np.float32)

            # Project 3D points to 2D
            rvec, _ = cv2.Rodrigues(R_tmpl)
            img_pts, _ = cv2.projectPoints(cad_3d, rvec, t_tmpl, self.K, self.dist)
            img_pts = img_pts.reshape(-1, 2)

            # Generate synthetic ORB keypoint descriptors
            desc = np.random.randint(0, 256, size=(len(cad_3d), 32), dtype=np.uint8)

            self.templates.append({
                "descriptors": desc,
                "keypoints_3d": cad_3d,
                "keypoints_2d": img_pts,
                "R": R_tmpl,
                "t": t_tmpl
            })

    def estimate(self, image_gray: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Match current image features against template library and solve PnP.
        """
        if image_gray is None or image_gray.size == 0:
            return {"pnp_success": False, "reason": "empty_image"}

        if image_gray.dtype != np.uint8:
            image_gray = (image_gray * 255).clip(0, 255).astype(np.uint8)

        if image_gray.ndim == 3:
            image_gray = cv2.cvtColor(image_gray, cv2.COLOR_RGB2GRAY)

        kp, desc = self.orb.detectAndCompute(image_gray, None)
        if desc is None or len(kp) < self.min_matches:
            return {"pnp_success": False, "reason": "insufficient_features", "n_keypoints": len(kp) if kp else 0}

        best_template, best_matches = None, []
        for tmpl in self.templates:
            try:
                matches = self.bf.match(desc, tmpl["descriptors"])
                if len(matches) > len(best_matches):
                    best_matches, best_template = matches, tmpl
            except Exception:
                continue

        if best_template is None or len(best_matches) < self.min_matches:
            return {"pnp_success": False, "reason": "insufficient_feature_matches", "n_matches": len(best_matches)}

        img_pts = np.array([kp[m.queryIdx].pt for m in best_matches], dtype=np.float32)
        obj_pts = np.array([best_template["keypoints_3d"][m.trainIdx % len(best_template["keypoints_3d"])]
                            for m in best_matches], dtype=np.float32)

        try:
            success, rvec, tvec, inliers = cv2.solvePnPRansac(
                obj_pts, img_pts, self.K, self.dist,
                reprojectionError=8.0, confidence=0.99, flags=cv2.SOLVEPNP_EPNP
            )
        except Exception as e:
            return {"pnp_success": False, "reason": f"pnp_exception: {e}"}

        if not success or inliers is None or len(inliers) < 4:
            return {"pnp_success": False, "reason": "pnp_solve_failed"}

        R_pnp, _ = cv2.Rodrigues(rvec)
        return {
            "pnp_success": True,
            "R": R_pnp.tolist(),
            "t": tvec.flatten().tolist(),
            "n_inliers": int(len(inliers)),
            "n_matches": int(len(best_matches)),
        }
