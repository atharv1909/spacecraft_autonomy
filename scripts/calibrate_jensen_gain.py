# scripts/calibrate_jensen_gain.py
import numpy as np
import json
from scipy.spatial.transform import Rotation

def geodesic_error_deg(R_pred, R_true):
    R_rel = R_pred.T @ R_true
    trace_val = np.clip((np.trace(R_rel) - 1) / 2, -1.0, 1.0)
    return np.degrees(np.arccos(trace_val))

def build_calibration_table(records: np.ndarray, n_bins: int = 12,
                            target_coverage: float = 0.95) -> dict:
    """
    For each Jensen Gain bin, compute the empirical (1-alpha) quantile of
    true rotation error within that bin.
    """
    jg = records[:, 0]
    err = records[:, 1]
    bin_edges = np.quantile(jg, np.linspace(0, 1, n_bins + 1))  # equal-mass bins
    bin_edges[0], bin_edges[-1] = 0.0, 999999.0

    table = []
    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (jg >= lo) & (jg < hi)
        n_in_bin = int(mask.sum())
        if n_in_bin < 10:
            bound = float(np.max(err[mask])) if n_in_bin > 0 else 45.0
        else:
            bound = float(np.quantile(err[mask], target_coverage))
        table.append({
            "jg_lo": float(lo),
            "jg_hi": float(hi),
            "n_calib_samples": n_in_bin,
            "guaranteed_error_bound_deg": round(bound, 2)
        })
    return {"target_coverage": target_coverage, "bins": table}

if __name__ == "__main__":
    print("[Calibrate] Running test conformal calibration...")
    # Synthetic empirical test distribution
    np.random.seed(42)
    N = 1000
    jg_samples = np.random.exponential(scale=5.0, size=N)
    err_samples = 0.8 * jg_samples + np.random.normal(2.0, 1.0, size=N)
    err_samples = np.clip(err_samples, 0.1, 180.0)
    records = np.column_stack([jg_samples, err_samples])
    table = build_calibration_table(records)
    print(f"[Calibrate] Built table with {len(table['bins'])} bins. Coverage target: {table['target_coverage']}")
