#!/usr/bin/env python3
"""
Comprehensive Validation Test Suite for FARAWAY Safety & Credibility Additions
Project: SYMBIOSIS
Tests all 8 features:
  #1: Physics Cross-Check & Dual-Trust Gating
  #2: Mahalanobis OOD Detector & 4-State Confidence Taxonomy
  #3: Independent Template PnP Pose Estimator & Cross-Estimator Agreement
  #4: Exact Clopper-Pearson 99% Upper Bound on Collision Probability
  #5: Conformally-Calibrated Confidence & Distribution-Free Guarantees
  #6: Root-Cause Causal Graph Traversal
  #7: Tamper-Evident SHA-256 Hash-Chained Decision Log
  #8: Graduated Autonomy Ladder
"""

import os
import sys
import json
import unittest
import numpy as np
from datetime import datetime, timezone


# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from orchestrator.message_schemas import (
    PoseEstimateMessage, SituationVectorMessage,
    ActionRecommendationMessage, ConsensusActionMessage,
    ActionType, OverrideLevel
)
from orchestrator.consensus import ConsensusEngine
from orchestrator.autonomy_ladder import required_autonomy_level
from orchestrator.audit_log import HashChainedLog
from orchestrator.state_manager import SharedState

from action.agent import clopper_pearson_upper_bound
from action.physics import default_spacecraft_config

from cognition.causal_graph import find_root_cause, SubsystemState
from cognition.cognition_agent import HyperdimensionalCognitionLayer, PoseEstimate, Telemetry, AnomalyReport

from perception.physics_crosscheck import PhysicsCrossChecker
from perception.models.calibrated_confidence import CalibratedConfidence
from perception.models.ood_detector import MahalanobisOODDetector
from perception.models.pnp_crosscheck import TemplatePnPEstimator
from perception.models.estimator_agreement import compare_estimates
from perception.perception_agent import PerceptionAgent


class TestFARAWAYSafetySuite(unittest.TestCase):

    def test_feature_7_tamper_evident_log(self):
        """#7: Decision log produces hash-chained SHA-256 records and detects tampering."""
        test_log_path = "orchestrator/logs/test_decision_log.jsonl"
        os.makedirs(os.path.dirname(test_log_path), exist_ok=True)
        if os.path.exists(test_log_path):
            os.remove(test_log_path)

        log = HashChainedLog(log_path=test_log_path)
        log.append({"cycle": 1, "action": "PROCEED_SLOW", "consensus": True})
        log.append({"cycle": 2, "action": "HOLD_POSITION", "consensus": False})
        log.append({"cycle": 3, "action": "RECONFIGURE_POWER", "consensus": True})

        verify_res = HashChainedLog.verify(test_log_path)
        self.assertTrue(verify_res["valid"], "Clean hash chain must verify as valid")
        self.assertEqual(verify_res["entries_verified"], 3)

        # Tamper test
        with open(test_log_path, "r") as f:
            lines = f.readlines()
        # Tamper line 2 payload
        tampered_record = json.loads(lines[1])
        tampered_record["decision"]["action"] = "ABORT"  # unauthorized modification
        lines[1] = json.dumps(tampered_record) + "\n"
        with open(test_log_path, "w") as f:
            f.writelines(lines)

        tampered_verify = HashChainedLog.verify(test_log_path)
        self.assertFalse(tampered_verify["valid"], "Tampered log must fail hash verification")
        
        # Cleanup
        if os.path.exists(test_log_path):
            os.remove(test_log_path)
        print("  [OK] Feature #7 (Tamper-Evident Log): Verified & Anti-Tamper Validated")

    def test_feature_4_clopper_pearson_bound(self):
        """#4: Exact Clopper-Pearson 99% upper bound calculation."""
        # 0 collisions in 100 MC runs with 99% confidence
        # Formula: 1 - (1 - 0.99)**(1/100) = 1 - 0.01**0.01 = 0.044817
        bound_0_100 = clopper_pearson_upper_bound(0, 100, 0.99)
        self.assertAlmostEqual(bound_0_100, 0.0448, places=3)

        # 5 collisions in 100 MC runs
        bound_5_100 = clopper_pearson_upper_bound(5, 100, 0.99)
        self.assertGreater(bound_5_100, 0.05)
        self.assertLess(bound_5_100, 0.15)
        print(f"  [OK] Feature #4 (Clopper-Pearson): 0/100 bound = {bound_0_100:.4f}, 5/100 bound = {bound_5_100:.4f}")

    def test_feature_5_conformal_calibration(self):
        """#5: Conformal calibration provides quantile bounds and distribution-free guarantees."""
        calib = CalibratedConfidence()
        # Low jensen gain (e.g. 0.8 deg) -> bound < 5.0 deg
        res_low = calib.lookup(0.8)
        self.assertLessEqual(res_low["guaranteed_rotation_error_bound_deg"], 5.0)
        self.assertEqual(res_low["confidence_level"], "high")

        # Moderate/High jensen gain (e.g. 20.0 deg) -> bound ~28.5 deg
        res_med = calib.lookup(20.0)
        self.assertGreaterEqual(res_med["guaranteed_rotation_error_bound_deg"], 25.0)
        self.assertEqual(res_med["confidence_level"], "low")

        # Critical jensen gain (e.g. 50.0 deg) -> critical
        res_crit = calib.lookup(50.0)
        self.assertEqual(res_crit["confidence_level"], "critical")
        print(f"  [OK] Feature #5 (Conformal Calibration): Low JG bound={res_low['guaranteed_rotation_error_bound_deg']}°, Med JG bound={res_med['guaranteed_rotation_error_bound_deg']}°, Crit JG level={res_crit['confidence_level']}")


    def test_feature_6_root_cause_graph(self):
        """#6: Causal graph traversal isolates root cause from downstream symptom cascade."""
        # Scenario: Radiator fails (thermal) -> solar panel overheats (power) -> life support degrades (life_support)
        states = {
            "thermal": SubsystemState("thermal", "failed"),
            "power": SubsystemState("power", "critical"),
            "life_support": SubsystemState("life_support", "critical")
        }
        res = find_root_cause(states)
        self.assertEqual(res["root_cause"], "thermal", "Thermal must be identified as the true root cause")
        self.assertIn("thermal", res["cascade"][0])
        print(f"  [OK] Feature #6 (Root-Cause Causal Graph): Isolated root cause '{res['root_cause']}', narrative='{res['narrative']}'")

    def test_feature_8_graduated_autonomy_ladder(self):
        """#8: Graduated autonomy ladder assigns appropriate override level from evidence."""
        # Nominal case -> Full autonomy
        nom = required_autonomy_level(
            jensen_gain_calibrated_bound_deg=4.5,
            physics_consistent=True,
            is_in_distribution=True,
            novelty_score=0.1
        )
        self.assertEqual(nom["required_level"], "AUTONOMOUS")

        # Moderate uncertainty -> Acknowledge (Level 1)
        mod = required_autonomy_level(
            jensen_gain_calibrated_bound_deg=14.0,
            physics_consistent=True,
            is_in_distribution=True,
            novelty_score=0.45
        )
        self.assertEqual(mod["required_level"], OverrideLevel.ACKNOWLEDGE.value)

        # Critical OOD + High error bound -> Replace / Reject (Level 3/4)
        crit = required_autonomy_level(
            jensen_gain_calibrated_bound_deg=28.0,
            physics_consistent=False,
            is_in_distribution=False,
            novelty_score=0.85
        )
        self.assertEqual(crit["required_level"], OverrideLevel.REPLACE.value)
        print(f"  [OK] Feature #8 (Graduated Autonomy): Nominal={nom['required_level']}, Moderate={mod['required_level']}, Critical={crit['required_level']}")

    def test_feature_1_physics_crosscheck(self):
        """#1: Physics cross-check propagates CWH state and flags dynamic violations."""
        checker = PhysicsCrossChecker(mean_motion=0.001107, residual_threshold_m=2.0)
        # Step 1: Initial state
        t0 = 1000.0
        r0 = np.array([50.0, 0.0, 0.0])
        res0 = checker.update(r0, t0)
        self.assertTrue(res0["physics_consistent"])

        # Step 2: Physically plausible step (dt = 1.0s, delta r = 0.05m)
        t1 = 1001.0
        r1 = np.array([50.05, 0.0, 0.0])
        res1 = checker.update(r1, t1)
        self.assertTrue(res1["physics_consistent"])

        # Step 3: Physically impossible teleportation (dt = 1.0s, delta r = 25m)
        t2 = 1002.0
        r2 = np.array([75.0, 0.0, 0.0])
        res2 = checker.update(r2, t2)
        self.assertFalse(res2["physics_consistent"], "Impossible orbital velocity jump must be flagged inconsistent")
        print(f"  [OK] Feature #1 (Physics Cross-Check): Consistency check passed (violation residual={res2['physics_residual_m']:.2f}m)")

    def test_feature_2_ood_detector(self):
        """#2: Mahalanobis OOD detector scores feature deviations."""
        detector = MahalanobisOODDetector(threshold_99th=25.0)
        in_feat = np.zeros(512)
        out_feat = np.ones(512) * 5.0

        res_in = detector.score(in_feat)
        res_out = detector.score(out_feat)

        self.assertTrue(res_in["is_in_distribution"])
        self.assertFalse(res_out["is_in_distribution"])
        print(f"  [OK] Feature #2 (OOD Detector): In-dist score={res_in['ood_distance']}, Out-of-dist score={res_out['ood_distance']}")

    def test_feature_3_redundant_pnp_estimator(self):
        """#3: Independent PnP estimator matches agreement with neural output."""
        R_nn = np.eye(3)
        t_nn = np.array([0.0, 0.0, 15.0])

        pnp_agree = {
            "pnp_success": True,
            "R": np.eye(3).tolist(),
            "t": [0.1, 0.0, 15.1],
            "n_inliers": 15
        }
        res_agree = compare_estimates(R_nn, t_nn, pnp_agree)
        self.assertTrue(res_agree["cross_estimator_agreement"])

        pnp_disagree = {
            "pnp_success": True,
            "R": np.array([[-1, 0, 0], [0, -1, 0], [0, 0, 1]]).tolist(),  # 180 deg flip
            "t": [10.0, 0.0, 15.0],
            "n_inliers": 8
        }
        res_disagree = compare_estimates(R_nn, t_nn, pnp_disagree)
        self.assertFalse(res_disagree["cross_estimator_agreement"])
        self.assertGreater(res_disagree["rotation_disagreement_deg"], 90.0)
        print(f"  [OK] Feature #3 (Redundant PnP): Agreement={res_agree['cross_estimator_agreement']}, Disagreement rot diff={res_disagree['rotation_disagreement_deg']}°")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  RUNNING SYMBIOSIS FARAWAY SAFETY & CREDIBILITY TEST SUITE")
    print("=" * 70)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFARAWAYSafetySuite)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("\n" + "=" * 70)
        print("  ALL 8 FARAWAY SAFETY FEATURES VALIDATED WITH ZERO FAILURES")
        print("=" * 70 + "\n")
        sys.exit(0)
    else:
        sys.exit(1)
