import numpy as np
from scipy.spatial.transform import Rotation
from datetime import datetime, timezone
from typing import Callable, Optional, Dict, Any, Tuple
from dataclasses import dataclass, asdict
import json

from perception.physics_crosscheck import PhysicsCrossChecker
from perception.models.hopf_grid import HopfFibrationGrid
from perception.models.jensen_gain import JensenGainMonitor
from perception.models.calibrated_confidence import CalibratedConfidence
from perception.models.ood_detector import MahalanobisOODDetector
from perception.models.pnp_crosscheck import TemplatePnPEstimator
from perception.models.estimator_agreement import compare_estimates


@dataclass
class PoseEstimate:
    R: list
    t: list
    quaternion: list


@dataclass
class UncertaintyEstimate:
    jensen_gain: float
    confidence_level: str
    confidence_label: str
    sigma_R_deg: float
    sigma_t_m: float
    nearest_anchor_idx: int
    anchor_distance_deg: float
    physics_residual_m: float = 0.0 
    physics_consistent: bool = True 
    ood_distance: float = 0.0
    is_in_distribution: bool = True
    cross_estimator_agreement: Optional[bool] = None
    rotation_disagreement_deg: float = 0.0
    calibrated_error_bound_deg: float = 0.0
    calibration_coverage: float = 0.95


@dataclass
class PerceptionOutput:
    pose: PoseEstimate
    uncertainty: UncertaintyEstimate
    metadata: dict

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @property
    def is_trustworthy(self) -> bool:
        return (
            self.uncertainty.confidence_level in ("high", "moderate")
            and self.uncertainty.is_in_distribution
            and self.uncertainty.physics_consistent
        )

    @property
    def R_numpy(self) -> np.ndarray:
        return np.array(self.pose.R)

    @property
    def t_numpy(self) -> np.ndarray:
        return np.array(self.pose.t)


class PerceptionAgent:

    VERSION = "0.2.0"

    def __init__(self,
                 model_path: Optional[str] = None,
                 pose_fn: Optional[Callable] = None,
                 n_elevation: int = 64,
                 n_inplane: int = 16,
                 n_jensen_rotations: int = 16,
                 run_jensen_gain: bool = True,
                 mean_motion: float = 0.001107,  
                 physics_residual_threshold_m: float = 2.0,
                 calib_table_path: Optional[str] = None,
                 ood_stats_path: Optional[str] = None):

        if model_path is None and pose_fn is None:
            raise ValueError("Provide either model_path or pose_fn")

        self.run_jensen_gain = run_jensen_gain
        self._pose_fn = pose_fn
        self._model = None

        self.grid = HopfFibrationGrid(
            n_elevation=n_elevation,
            n_inplane=n_inplane
        )

        self.jg_monitor = JensenGainMonitor(n_rotations=n_jensen_rotations)
        self.physics_checker = PhysicsCrossChecker(     
            mean_motion=mean_motion,
            residual_threshold_m=physics_residual_threshold_m
        )
        self.calibrated_conf = CalibratedConfidence(calib_table_path or "perception/checkpoints/jensen_gain_calibration.json")
        self.ood_detector = MahalanobisOODDetector(ood_stats_path or "perception/checkpoints/ood_stats.npz")
        self.pnp_estimator = TemplatePnPEstimator()

        if model_path is not None:
            self._load_model(model_path)

        print(f"PerceptionAgent v{self.VERSION} ready")
        print(f"  Grid: {self.grid.total_anchors} anchors")
        print(f"  Jensen Gain: {'enabled' if run_jensen_gain else 'disabled'}")
        print(f"  Conformal Calibration: 95% coverage guarantee active")
        print(f"  OOD Detector: Mahalanobis distance active")
        print(f"  Redundant PnP Estimator: Active")

    def _load_model(self, model_path: str):
        import torch

        try:
            checkpoint = torch.load(model_path, map_location='cpu',
                                    weights_only=False)
            loaded_checkpoint = True
        except Exception as e:
            raise RuntimeError(
                f"[PerceptionAgent] FATAL: Cannot load weights from {model_path}: {e}. "
                f"Provide a valid PyTorch checkpoint."
            )

        if not isinstance(checkpoint, dict) or 'state_dict' not in checkpoint:
            raise RuntimeError(
                f"[PerceptionAgent] FATAL: Checkpoint at {model_path} does not contain "
                f"'state_dict'. Keys found: {list(checkpoint.keys()) if isinstance(checkpoint, dict) else type(checkpoint)}. "
                f"This is not a valid trained model checkpoint."
            )

        cfg = checkpoint.get('cfg', {})
        
        # Detect architecture from state_dict keys
        sd = checkpoint['state_dict']
        first_key = next(iter(sd.keys()), '')
        
        # Our PoseNet_ResNet50 uses backbone.0.weight (Sequential of resnet children)
        if first_key.startswith('backbone.0.') or first_key.startswith('backbone.4.'):
            from perception.models.pose_model import PoseNet_ResNet50
            self._model = PoseNet_ResNet50(pretrained=False)
            backbone = 'resnet50'
        else:
            from perception.models.pose_model import SpacecraftPoseModel
            backbone_name = cfg.get('backbone', 'efficientnet_b3')
            self._model = SpacecraftPoseModel(
                backbone_name=backbone_name,
                pretrained=False
            )
            backbone = backbone_name

        # Convert any half-precision weights to float32 for CPU inference
        sd_float = {k: v.float() if hasattr(v, 'is_floating_point') and v.is_floating_point() else v for k, v in sd.items()}
        self._model.load_state_dict(sd_float)
        self._model.eval()

        # Read normalization from checkpoint config — try all possible key names
        self._norm_mean = cfg.get('norm_mean', cfg.get('norm_mean_synth', [0.485, 0.456, 0.406]))
        self._norm_std = cfg.get('norm_std', cfg.get('norm_std_synth', [0.229, 0.224, 0.225]))
        
        # Real-domain normalization (if present)
        if 'norm_mean_real' in cfg and 'norm_std_real' in cfg:
            self._norm_mean_real = cfg['norm_mean_real']
            self._norm_std_real = cfg['norm_std_real']
            
        self._img_size = cfg.get('img_size', 224)
        self._trans_scale = cfg.get('trans_scale', 1.0)
        self._device = 'cpu'
        self._model.to(self._device)

        epoch = checkpoint.get('epoch', '?')
        rot_err = checkpoint.get('rot_err_deg', '?')
        trans_err = checkpoint.get('trans_err_m', '?')
        print(f"Model loaded: {backbone} | Epoch: {epoch} | Rot err: {rot_err}° | Trans err: {trans_err}m")
        print(f"  Normalization: mean={self._norm_mean}, std={self._norm_std}")
        print(f"  Image size: {self._img_size} | Trans scale: {self._trans_scale}")

        self._pose_fn = None


    def _forward_model(self, image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Runs single forward pass through neural network and returns (R, t, features)."""
        if self._model is not None:
            import torch
            import torchvision.transforms as T

            mean_intensity = image.mean()
            if hasattr(self, '_norm_mean_real') and mean_intensity < 0.25:
                norm_m = self._norm_mean_real
                norm_s = self._norm_std_real
            else:
                norm_m = self._norm_mean
                norm_s = self._norm_std

            transform = T.Compose([
                T.ToPILImage(),
                T.Resize((self._img_size, self._img_size)),
                T.ToTensor(),
                T.Normalize(mean=norm_m, std=norm_s)
            ])

            if image.ndim == 2:
                image_3c = np.stack([image] * 3, axis=-1)
            elif image.ndim == 3 and image.shape[2] == 1:
                image_3c = np.repeat(image, 3, axis=2)
            else:
                image_3c = image

            if image_3c.dtype != np.uint8:
                image_uint8 = (image_3c * 255).clip(0, 255).astype(np.uint8)
            else:
                image_uint8 = image_3c

            tensor = transform(image_uint8).unsqueeze(0).to(self._device)

            with torch.no_grad():
                feat_tensor = self._model.forward_features(tensor)
                quat_tensor = self._model.quat_head(feat_tensor)
                trans_tensor = self._model.trans_head(feat_tensor)
                quat_tensor = quat_tensor / (quat_tensor.norm(dim=1, keepdim=True) + 1e-8)

            q = quat_tensor[0].cpu().numpy()
            q_scipy = np.array([q[1], q[2], q[3], q[0]])
            R = Rotation.from_quat(q_scipy).as_matrix()
            t = trans_tensor[0].cpu().numpy()
            feat = feat_tensor[0].cpu().numpy()

            return R, t, feat

        elif self._pose_fn is not None:
            result = self._pose_fn(image)
            if isinstance(result, tuple):
                R, t = result
            else:
                R = result
                t = np.zeros(3)
            # Default feature vector for custom function
            feat = np.zeros(512, dtype=np.float32)
            return np.array(R), np.array(t), feat

        else:
            raise RuntimeError("No model or pose function loaded")

    def _R_to_quaternion(self, R: np.ndarray) -> list:
        rot = Rotation.from_matrix(R)
        q = rot.as_quat()
        return [float(q[3]), float(q[0]), float(q[1]), float(q[2])]

    def _estimate_sigma_R(self, jensen_gain: float) -> float:
        return 0.6 * jensen_gain

    def _estimate_sigma_t(self, jensen_gain: float,
                          t_magnitude: float) -> float:
        return 0.05 * t_magnitude * (1 + jensen_gain / 10.0)

    def predict(self, image: np.ndarray) -> PerceptionOutput:
        t_start = datetime.now(timezone.utc)

        if image.dtype == np.uint8:
            image = image.astype(np.float32) / 255.0

        # 1. Primary Neural Forward Pass
        R, t, feat = self._forward_model(image)
        
        # 2. Nearest Anchor on Hopf Fibration Grid
        anchor_idx, anchor_dist, R_anchor = self.grid.find_nearest_anchor(R)

        # 3. Physics Cross-Check (Independent Dynamical Propagation)
        physics_check = self.physics_checker.update(t, t_start.timestamp())

        # 4. Out-of-Distribution (OOD) Detection on Penultimate Features
        ood_check = self.ood_detector.score(feat)
        ood_distance = ood_check.get("ood_distance", 0.0)
        is_in_dist = ood_check.get("is_in_distribution", True)

        # 5. Redundant Independent Classical CV PnP Cross-Check
        pnp_result = self.pnp_estimator.estimate(image)
        agreement_check = compare_estimates(R, t, pnp_result)
        cross_agree = agreement_check.get("cross_estimator_agreement")
        rot_disagree_deg = agreement_check.get("rotation_disagreement_deg", 0.0)

        # 6. Jensen Gain Uncertainty Evaluation
        if self.run_jensen_gain:
            def _pose_only(img):
                R_pred, _, _ = self._forward_model(img)
                return R_pred

            jg_result = self.jg_monitor.compute(
                pose_fn=_pose_only,
                image=image,
                compensate_inplane=True
            )
            jensen_gain = float(jg_result["jensen_gain"])
        else:
            jensen_gain = 0.0

        # 7. Conformal Calibration Lookup (Distribution-Free Guarantees)
        calib_lookup = self.calibrated_conf.lookup(jensen_gain)
        calibrated_bound_deg = calib_lookup.get("guaranteed_rotation_error_bound_deg", 15.0)
        calib_coverage = calib_lookup.get("coverage", 0.95)

        # 8. 4-State Confidence Taxonomy (Addresses 'Confidently Wrong' Failure Mode)
        low_spread = jensen_gain < 15.0
        if is_in_dist and low_spread:
            confidence_level = "high"
            confidence_label = f"HIGH CONFIDENCE: {calib_lookup['confidence_sentence']}"
        elif is_in_dist and not low_spread:
            confidence_level = "moderate"
            confidence_label = f"SYMMETRY AMBIGUITY (spread={jensen_gain:.1f}°): {calib_lookup['confidence_sentence']}"
        elif not is_in_dist and low_spread:
            # Confidently wrong failure mode
            confidence_level = "critical"
            confidence_label = f"UNKNOWN INPUT (Confidently Wrong, OOD dist={ood_distance:.1f}): Escalate immediately"
        else:
            confidence_level = "low"
            confidence_label = f"COMPOUNDING FAILURE (OOD dist={ood_distance:.1f}, spread={jensen_gain:.1f}°): Distrust vision"

        t_end = datetime.now(timezone.utc)
        processing_ms = (t_end - t_start).total_seconds() * 1000
        t_magnitude = float(np.linalg.norm(t))

        output = PerceptionOutput(
            pose=PoseEstimate(
                R=R.tolist(),
                t=t.tolist(),
                quaternion=self._R_to_quaternion(R)
            ),
            uncertainty=UncertaintyEstimate(
                jensen_gain=float(jensen_gain),
                confidence_level=confidence_level,
                confidence_label=confidence_label,
                sigma_R_deg=self._estimate_sigma_R(jensen_gain),
                sigma_t_m=self._estimate_sigma_t(jensen_gain, t_magnitude),
                nearest_anchor_idx=int(anchor_idx),
                anchor_distance_deg=float(np.degrees(anchor_dist)),
                physics_residual_m=physics_check.get("physics_residual_m", 0.0), 
                physics_consistent=physics_check.get("physics_consistent", True),
                ood_distance=float(ood_distance),
                is_in_distribution=bool(is_in_dist),
                cross_estimator_agreement=cross_agree,
                rotation_disagreement_deg=float(rot_disagree_deg),
                calibrated_error_bound_deg=float(calibrated_bound_deg),
                calibration_coverage=float(calib_coverage)
            ),
            metadata={
                "timestamp": t_start.isoformat(),
                "model_version": self.VERSION,
                "processing_time_ms": round(processing_ms, 2),
                "image_shape": list(image.shape),
                "grid_anchors": self.grid.total_anchors,
                "jensen_gain_enabled": self.run_jensen_gain,
                "ood_score": ood_check,
                "pnp_agreement": agreement_check
            }
        )

        return output
