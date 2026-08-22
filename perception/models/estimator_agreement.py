import numpy as np
from typing import Optional, Dict, Any

def compare_estimates(R_nn: np.ndarray, t_nn: np.ndarray,
                      pnp_result: Optional[Dict[str, Any]],
                      rot_agree_thresh_deg: float = 20.0,
                      trans_agree_thresh_m: float = 3.0) -> Dict[str, Any]:
    """
    Compares the neural network pose estimate with the independent classical PnP estimate.
    Disagreement indicates an independent, orthogonal signal of perception failure.
    """
    if pnp_result is None or not pnp_result.get("pnp_success", False):
        return {
            "cross_estimator_agreement": None,
            "rotation_disagreement_deg": 0.0,
            "translation_disagreement_m": 0.0,
            "note": "PnP fallback unavailable this frame (insufficient features)"
        }

    R_pnp = np.array(pnp_result["R"], dtype=float)
    t_pnp = np.array(pnp_result["t"], dtype=float)
    R_nn = np.array(R_nn, dtype=float)
    t_nn = np.array(t_nn, dtype=float)

    # Relative geodesic rotation error
    R_rel = R_nn.T @ R_pnp
    trace_val = np.clip((np.trace(R_rel) - 1.0) / 2.0, -1.0, 1.0)
    rot_diff_deg = float(np.degrees(np.arccos(trace_val)))
    trans_diff_m = float(np.linalg.norm(t_nn - t_pnp))

    agree = bool((rot_diff_deg <= rot_agree_thresh_deg) and (trans_diff_m <= trans_agree_thresh_m))

    return {
        "cross_estimator_agreement": agree,
        "rotation_disagreement_deg": round(rot_diff_deg, 2),
        "translation_disagreement_m": round(trans_diff_m, 3),
        "pnp_inliers": pnp_result.get("n_inliers", 0)
    }
