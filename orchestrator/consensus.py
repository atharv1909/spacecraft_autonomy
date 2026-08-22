from typing import Dict, Optional
from .message_schemas import (
    ActionType, ConfidenceLevel, OverrideLevel,
    PoseEstimateMessage, SituationVectorMessage,
    ActionRecommendationMessage, HumanOverrideMessage,
    ConsensusActionMessage
)
from .state_manager import SharedState
from .autonomy_ladder import required_autonomy_level

# Conservative action ordering — lower index = safer
SAFETY_RANKING = [
    ActionType.ABORT,
    ActionType.EMERGENCY_VENT,
    ActionType.HOLD_POSITION,
    ActionType.ISOLATE_MODULE,
    ActionType.RECONFIGURE_POWER,
    ActionType.PROCEED_CREEP,
    ActionType.PROCEED_SLOW,
    ActionType.PROCEED_NORMAL,
    ActionType.AWAIT_HUMAN,
    ActionType.AUTONOMOUS_FALLBACK,
]


def most_conservative(actions: list) -> str:
    """Return the most conservative action from a list."""
    ranked = []
    for a in actions:
        try:
            ranked.append((SAFETY_RANKING.index(a), a))
        except ValueError:
            ranked.append((len(SAFETY_RANKING), a))
    ranked.sort(key=lambda x: x[0])
    return ranked[0][1] if ranked else ActionType.HOLD_POSITION


class ConsensusEngine:
    """
    Implements the consensus and conflict resolution protocol.

    Rules:
    1. If Perception confidence LOW or Physics disagrees -> Cognition must use conservative policy
    2. If Cognition flags novelty -> Action defaults to HOLD
    3. If Action proposes high-risk or upper-bound collision prob high -> require human confirmation
    4. Tie-breaker: most conservative action wins
    5. Any CRITICAL uncertainty / Autonomy escalation -> escalate to human
    6. Human override always wins -> apply immediately
    """

    # Weights for voting (tunable)
    AGENT_WEIGHTS = {
        "perception": 0.3,
        "cognition":  0.4,
        "action":     0.3,
    }

    # High-risk actions that always need human confirmation
    HIGH_RISK_ACTIONS = {
        ActionType.EMERGENCY_VENT,
        ActionType.ABORT,
    }

    def run(self,
            state: SharedState,
            perception_msg: Optional[PoseEstimateMessage] = None,
            cognition_msg: Optional[SituationVectorMessage] = None,
            action_msg: Optional[ActionRecommendationMessage] = None,
            human_msg: Optional[HumanOverrideMessage] = None
            ) -> ConsensusActionMessage:
        """
        Core consensus logic. Called every decision cycle.

        Returns a ConsensusActionMessage with the final decided action.
        """
        votes = {}
        reasoning_parts = []
        escalate = False
        fallback = False

        # ── Rule 0: Human override always wins ──────────────────────────
        if human_msg is not None:
            return self._apply_human_override(human_msg, votes)

        # ── Rule 1: Perception confidence & physics cross-check ─────────
        perception_vote = ActionType.HOLD_POSITION
        if perception_msg is not None:
            vision_ok = perception_msg.is_trustworthy
            physics_ok = perception_msg.physics_consistent
            in_dist_ok = getattr(perception_msg, "is_in_distribution", True)
            cross_agree = getattr(perception_msg, "cross_estimator_agreement", None)

            if not (vision_ok and physics_ok and in_dist_ok):
                perception_vote = ActionType.HOLD_POSITION
                if not vision_ok and not physics_ok:
                    reasoning_parts.append("BOTH vision self-consistency AND physics cross-check failed -> HIGH SEVERITY escalation")
                    escalate = True
                elif not physics_ok:
                    reasoning_parts.append(f"Vision confident but physics disagrees (residual={perception_msg.physics_residual_m:.2f}m) -> distrust vision")
                    escalate = True
                elif not in_dist_ok:
                    ratio = getattr(perception_msg, "ood_severity_ratio", 2.0)
                    if ratio < 1.5:
                        perception_vote = ActionType.PROCEED_CREEP
                        reasoning_parts.append(f"Mild OOD (ratio={ratio:.2f}) -> CREEP, not full hold")
                    else:
                        perception_vote = ActionType.HOLD_POSITION
                        reasoning_parts.append(f"Severe OOD (ratio={ratio:.2f}) -> HOLD")
                        escalate = True
                else:
                    reasoning_parts.append(f"Vision uncertain (Jensen Gain {perception_msg.jensen_gain:.1f}°) -> HOLD")
                    escalate = True
            elif cross_agree is False:
                perception_vote = ActionType.HOLD_POSITION
                rot_disagree = getattr(perception_msg, "rotation_disagreement_deg", 0.0)
                reasoning_parts.append(f"Independent PnP cross-check disagreed with neural model ({rot_disagree:.1f}°) -> HOLD")
                escalate = True
            else:
                perception_vote = ActionType.PROCEED_SLOW
                reasoning_parts.append(
                    f"Perception OK (JG={perception_msg.jensen_gain:.1f}°, physics residual={perception_msg.physics_residual_m:.2f}m)"
                )
        else:
            # No perception data -> stale -> conservative
            perception_vote = ActionType.HOLD_POSITION
            reasoning_parts.append("No perception data -> HOLD")
            fallback = True

        votes["perception"] = perception_vote

        # ── Rule 2: Cognition novelty check ─────────────────────────────
        cognition_vote = ActionType.HOLD_POSITION
        if cognition_msg is not None:
            if cognition_msg.novelty_score > 0.7:
                cognition_vote = ActionType.HOLD_POSITION
                reasoning_parts.append(
                    f"Cognition NOVEL situation (score {cognition_msg.novelty_score:.2f}) -> HOLD"
                )
                escalate = True
            elif cognition_msg.anomaly_detected:
                cognition_vote = cognition_msg.recommended_action
                reasoning_parts.append(
                    f"Cognition: anomaly {cognition_msg.anomaly_type} ({cognition_msg.anomaly_severity}) -> {cognition_msg.recommended_action}"
                )
            else:
                cognition_vote = cognition_msg.recommended_action
                reasoning_parts.append(
                    f"Cognition: nominal -> {cognition_msg.recommended_action}"
                )
        else:
            cognition_vote = ActionType.HOLD_POSITION
            reasoning_parts.append("No cognition data -> HOLD")
            fallback = True

        votes["cognition"] = cognition_vote

        # ── Rule 3: Action agent high-risk check ────────────────────────
        action_vote = ActionType.HOLD_POSITION
        if action_msg is not None:
            if action_msg.primary_action in self.HIGH_RISK_ACTIONS:
                action_vote = ActionType.AWAIT_HUMAN
                reasoning_parts.append(f"High-risk action ({action_msg.primary_action}) requires human confirmation")
                escalate = True
            elif getattr(action_msg, "collision_prob_upper_bound_99", 0.0) > 0.15:
                # Exact 99% bound exceeds safety margin
                action_vote = ActionType.AWAIT_HUMAN
                reasoning_parts.append(
                    f"Collision prob mean={action_msg.collision_prob:.2f} but 99% bound={action_msg.collision_prob_upper_bound_99:.2f} -> escalating"
                )
                escalate = True
            else:
                action_vote = action_msg.primary_action
        else:
            action_vote = ActionType.HOLD_POSITION
            reasoning_parts.append("No action data -> HOLD")
            fallback = True

        votes["action"] = action_vote

        # ── Graduated Autonomy Ladder ────────────────────────────────────
        calib_error_bound = getattr(perception_msg, "calibrated_error_bound_deg", 0.0) if perception_msg else 30.0
        physics_consistent = getattr(perception_msg, "physics_consistent", True) if perception_msg else False
        is_in_distribution = getattr(perception_msg, "is_in_distribution", True) if perception_msg else False
        novelty_score = getattr(cognition_msg, "novelty_score", 0.0) if cognition_msg else 0.0

        autonomy_req = required_autonomy_level(
            jensen_gain_calibrated_bound_deg=calib_error_bound,
            physics_consistent=physics_consistent,
            is_in_distribution=is_in_distribution,
            novelty_score=novelty_score
        )
        req_level = autonomy_req["required_level"]
        autonomy_reasons = autonomy_req["reasons"]

        if req_level != "AUTONOMOUS":
            escalate = True
            reasoning_parts.append(f"Autonomy ladder requires level: {req_level} ({', '.join(autonomy_reasons)})")

        # ── Weighted voting & tiebreak ───────────────────────────────────
        all_votes = list(votes.values())
        unique_actions = set(all_votes)

        if len(unique_actions) == 1:
            # Full consensus
            final_action = all_votes[0]
            consensus_reached = True
            reasoning_parts.append("Full consensus reached")
        else:
            # Conflict -> most conservative wins
            final_action = most_conservative(all_votes)
            consensus_reached = False
            reasoning_parts.append(
                f"Conflict {[v for v in all_votes]} -> conservative tiebreak: {final_action}"
            )
            if not escalate:
                escalate = True

        return ConsensusActionMessage(
            final_action=final_action,
            consensus_reached=consensus_reached,
            votes=votes,
            override_applied=False,
            override_level="",
            escalated_to_human=escalate,
            reasoning=" | ".join(reasoning_parts),
            fallback_triggered=fallback,
            required_autonomy_level=req_level,
            autonomy_reasons=autonomy_reasons
        )

    def _apply_human_override(self,
                              human_msg: HumanOverrideMessage,
                              votes: dict) -> ConsensusActionMessage:
        """Human override immediately becomes final action."""
        return ConsensusActionMessage(
            final_action=human_msg.selected_action,
            consensus_reached=True,
            votes=votes,
            override_applied=True,
            override_level=human_msg.override_level,
            escalated_to_human=False,
            reasoning=f"HUMAN OVERRIDE Level {human_msg.override_level}: "
                      f"{human_msg.selected_action} | "
                      f"Rationale: {human_msg.rationale}",
            fallback_triggered=False
        )
