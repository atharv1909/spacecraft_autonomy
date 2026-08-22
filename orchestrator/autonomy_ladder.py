from .message_schemas import OverrideLevel

def required_autonomy_level(jensen_gain_calibrated_bound_deg: float,
                            physics_consistent: bool,
                            is_in_distribution: bool,
                            novelty_score: float) -> dict:
    """
    Maps accumulated uncertainty evidence onto the MINIMUM required human
    involvement level before the system is allowed to act autonomously.
    This does not replace the existing high-risk-action gate in
    ConsensusEngine (EMERGENCY_VENT/ABORT always require confirmation
    regardless of confidence) — it's an additional, continuous gate for
    everything else.
    """
    severity_score = 0.0
    reasons = []

    if jensen_gain_calibrated_bound_deg > 20.0:
        severity_score += 2
        reasons.append(f"high calibrated pose error bound ({jensen_gain_calibrated_bound_deg:.1f}° > 20°)")
    elif jensen_gain_calibrated_bound_deg > 10.0:
        severity_score += 1
        reasons.append(f"moderate calibrated pose error bound ({jensen_gain_calibrated_bound_deg:.1f}° > 10°)")

    if not physics_consistent:
        severity_score += 2
        reasons.append("physics cross-check failed (orbital dynamics mismatch)")

    if not is_in_distribution:
        severity_score += 3
        reasons.append("out-of-distribution input (potential confident-wrong perception)")

    if novelty_score > 0.7:
        severity_score += 2
        reasons.append(f"novel/unrecognized situation (novelty {novelty_score:.2f} > 0.7)")
    elif novelty_score > 0.4:
        severity_score += 1
        reasons.append(f"moderately novel situation (novelty {novelty_score:.2f} > 0.4)")

    if severity_score == 0:
        level = "AUTONOMOUS"                         # full autonomy, log only
    elif severity_score <= 2:
        level = OverrideLevel.ACKNOWLEDGE.value      # autonomy + notify, 1-click confirm
    elif severity_score <= 4:
        level = OverrideLevel.MODIFY.value           # requires parameter review
    else:
        level = OverrideLevel.REPLACE.value          # requires explicit action selection

    return {
        "required_level": level,
        "severity_score": severity_score,
        "reasons": reasons
    }
