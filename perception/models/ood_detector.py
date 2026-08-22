import numpy as np
import os
from typing import Dict, Any, Optional

class MahalanobisOODDetector:
    """
    Mahalanobis distance-based Out-of-Distribution detector on penultimate features.
    Catches 'confidently wrong' failure modes (e.g. non-spacecraft images, novel geometry).
    """

    def __init__(self, stats_path: Optional[str] = None, threshold_99th: float = 28.5):
        self.threshold = threshold_99th
        if stats_path and os.path.exists(stats_path):
            try:
                d = np.load(stats_path)
                self.mean = d["mean"]
                self.precision = d["precision"]
                if "threshold_99th" in d:
                    self.threshold = float(d["threshold_99th"])
            except Exception as e:
                print(f"[OODDetector] Warning: could not load {stats_path} ({e}), initializing standard distribution.")
                self.mean = np.zeros(512, dtype=np.float32)
                self.precision = np.eye(512, dtype=np.float32)
        else:
            self.mean = np.zeros(512, dtype=np.float32)
            self.precision = np.eye(512, dtype=np.float32)

    def score(self, feature: np.ndarray) -> Dict[str, Any]:
        """
        Compute Mahalanobis distance of feature vector to in-distribution stats.
        """
        feat = np.asarray(feature, dtype=np.float32).flatten()
        dim = feat.shape[0]

        if dim != self.mean.shape[0]:
            mean = self.mean[:dim] if self.mean.shape[0] >= dim else np.pad(self.mean, (0, dim - self.mean.shape[0]))
            prec = np.eye(dim, dtype=np.float32)
        else:
            mean = self.mean
            prec = self.precision

        delta = feat - mean
        dist_sq = float(delta @ prec @ delta.T)
        dist = float(np.sqrt(max(dist_sq, 0.0)))

        is_in = dist <= self.threshold
        return {
            "ood_distance": round(dist, 4),
            "threshold": round(self.threshold, 4),
            "is_in_distribution": is_in,
        }
