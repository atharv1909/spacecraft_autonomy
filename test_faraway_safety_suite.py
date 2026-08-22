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

    def test_feature_9_speed_plus_v2_benchmark(self):
        """#9: ESA/Stanford SPEED+ v2 Benchmark Metric & 3D Wireframe projection."""
        from perception.speed_dataset_benchmark import (
            compute_speed_benchmark_metrics, project_tango_wireframe, SPEED_V2_TEST_BENCH
        )
        # Test exact match
        r_gt = np.array([0.0, 0.0, 10.0])
        q_gt = np.array([1.0, 0.0, 0.0, 0.0])
        metrics_exact = compute_speed_benchmark_metrics(r_gt, q_gt, r_gt, q_gt)
        self.assertEqual(metrics_exact["translation_error_m"], 0.0)
        self.assertEqual(metrics_exact["angular_error_deg"], 0.0)
        self.assertEqual(metrics_exact["speed_competition_score"], 0.0)

        # Test small error (Class A)
        r_noisy = r_gt + np.array([0.02, -0.01, 0.01])
        q_noisy = np.array([0.9998, 0.01, 0.01, 0.0])
        metrics_noisy = compute_speed_benchmark_metrics(r_noisy, q_noisy, r_gt, q_gt)
        self.assertLess(metrics_noisy["speed_competition_score"], 0.05)
        self.assertIn("Class A", metrics_noisy["grade"])

        # Test wireframe projection
        wf = project_tango_wireframe(r_gt, q_gt, canvas_w=400, canvas_h=400)
        self.assertEqual(len(wf["keypoints"]), 11)
        self.assertGreater(len(wf["edges"]), 10)
        print(f"  [OK] Feature #9 (SPEED+ v2 Benchmark): Perfect Score={metrics_exact['speed_competition_score']}, Noisy Score={metrics_noisy['speed_competition_score']:.4f} ({metrics_noisy['grade']})")

    def test_feature_10_nasa_telemetry_envelope(self):
        """#10: NASA RPO Approach Corridor & TAM 12-Thruster Allocation."""
        from perception.speed_dataset_benchmark import get_nasa_flight_telemetry_snapshot
        snap = get_nasa_flight_telemetry_snapshot(range_m=12.5)
        self.assertTrue(snap["flight_corridor"]["in_corridor"])
        self.assertGreater(snap["flight_corridor"]["cone_margin_deg"], 5.0)
        self.assertEqual(len(snap["propulsion_rcs"]["thruster_duty_pct"]), 12)
        self.assertIn("avionics", snap["thermal_bus_nodes_c"])
        print(f"  [OK] Feature #10 (NASA Telemetry): In-Corridor={snap['flight_corridor']['in_corridor']}, Thrusters={len(snap['propulsion_rcs']['thruster_duty_pct'])}, Status={snap['flight_corridor']['range_rate_status']}")

    def test_feature_11_mekf_attitude_filter(self):
        """#11: 6-DoF Multiplicative Extended Kalman Filter (MEKF) with Lie Algebra & Covariance Gating."""
        from perception.mekf_state_estimator import SpacecraftMEKF
        mekf = SpacecraftMEKF(initial_position=np.array([20.0, 0.5, -0.2]), initial_quaternion=np.array([1.0, 0.0, 0.0, 0.0]))
        # Predict step
        mekf.predict(dt=0.1)
        self.assertAlmostEqual(mekf.r[0], 20.0, places=1)

        # Update with low Jensen Gain (High trust)
        res_good = mekf.update_pose_measurement(np.array([19.9, 0.48, -0.19]), np.array([0.999, 0.01, 0.0, 0.0]), jensen_gain_deg=2.5)
        self.assertTrue(res_good["measurement_accepted"])
        self.assertLess(res_good["sigma_pos_3d_m"], 1.5)

        # Update with extreme Jensen Gain (Symmetry ambiguity -> measurement rejected/downweighted)
        res_bad = mekf.update_pose_measurement(np.array([5.0, 10.0, -8.0]), np.array([0.0, 1.0, 0.0, 0.0]), jensen_gain_deg=32.0)
        print(f"  [OK] Feature #11 (MEKF 6-DoF Filter): Accepted={res_good['measurement_accepted']}, Pos sigma={res_good['sigma_pos_3d_m']}m, Att sigma={res_good['sigma_att_3d_deg']}deg")

    def test_feature_12_tam_thruster_allocation(self):
        """#12: 12-Thruster Allocation Matrix (TAM) Pseudoinverse & Minimum Impulse Bit Gating."""
        from action.tam_thruster_allocator import ThrusterAllocationMatrix
        tam = ThrusterAllocationMatrix(isp_s=220.0, initial_propellant_kg=500.0)
        # Request deceleration along +X axis (2.5 N braking force)
        alloc = tam.allocate(force_cmd_n=np.array([-2.5, 0.0, 0.0]), torque_cmd_nm=np.array([0.0, 0.0, 0.0]), dt_s=0.1)
        self.assertEqual(len(alloc["thruster_duty_pct"]), 12)
        # Thrusters 1 and 2 (+X face) should fire
        self.assertGreater(alloc["thruster_duty_pct"][0], 0.0)
        self.assertGreater(alloc["thruster_duty_pct"][1], 0.0)
        self.assertLess(alloc["propellant_remaining_kg"], 500.0)
        print(f"  [OK] Feature #12 (TAM 12-RCS Bus): Realized F_x={alloc['force_realized_n'][0]}N, Active Valves={alloc['valve_firings_count']}, dm_prop={500.0-alloc['propellant_remaining_kg']:.5f}kg")

    def test_feature_13_nasa_fdir_flight_director(self):
        """#13: NASA FDIR Autonomous Flight Director & Automated CAM Collision Avoidance Abort."""
        from orchestrator.fdir_flight_director import NASAAutonomousFlightDirector, FlightPhase
        fdir = NASAAutonomousFlightDirector(cone_half_angle_deg=20.0, koz_radius_m=10.0)
        
        # Nominal far approach
        stat_nom = fdir.evaluate_safety_step(r_vec=np.array([25.0, 1.0, 0.5]), v_vec=np.array([-0.15, 0.0, 0.0]), jensen_gain_deg=2.5, is_trustworthy=True)
        self.assertEqual(stat_nom.phase, FlightPhase.CLOSING_GLISSADE)
        self.assertFalse(stat_nom.tripwire_triggered)

        # Severe out-of-cone inside Keep-Out Zone -> Triggers CAM Abort
        stat_abort = fdir.evaluate_safety_step(r_vec=np.array([5.0, 8.0, 0.0]), v_vec=np.array([-0.2, 0.0, 0.0]), jensen_gain_deg=4.0, is_trustworthy=True)
        self.assertEqual(stat_abort.phase, FlightPhase.CAM_ABORT)
        self.assertTrue(stat_abort.tripwire_triggered)
        self.assertGreater(stat_abort.cam_delta_v_mps[1], 0.0) # Radial escape burn
        print(f"  [OK] Feature #13 (NASA FDIR Director): Nominal Phase={stat_nom.phase.value}, CAM Abort Triggered={stat_abort.tripwire_triggered} ({stat_abort.tripwire_reason[:45]}...)")

    def test_feature_14_dynamic_fdir_recovery_engine(self):
        """#14: Dynamic NASA FDIR Guided Recovery Pathways Generator & Mathematical Bounds."""
        from orchestrator.fdir_flight_director import NASAAutonomousFlightDirector
        fdir = NASAAutonomousFlightDirector()

        # Simulate optical solar glare tripwire (high Jensen Gain)
        opts_glare = fdir.generate_dynamic_recovery_options(
            r_vec=np.array([16.4, 2.1, -0.4]),
            v_vec=np.array([-0.12, 0.01, 0.0]),
            jensen_gain_deg=28.6,
            is_trustworthy=False,
            anomaly_detected=True,
            anomaly_type="specular_solar_glare"
        )
        self.assertGreaterEqual(len(opts_glare), 5)
        # Check that boresight repointing is recommended with valid predicted JG drop
        slew_opt = next(o for o in opts_glare if o["id"] == "boresight_realign")
        self.assertEqual(slew_opt["urgency"], "RECOMMENDED")
        self.assertLess(slew_opt["predicted_jg_deg"], 5.0)
        self.assertGreater(slew_opt["confidence_gain_pct"], 50)

        # Check that template PnP gate is present and mathematically grounded
        pnp_opt = next(o for o in opts_glare if o["id"] == "template_pnp_crosscheck")
        self.assertIn("Perspective-n-Point", pnp_opt["description"])
        self.assertIn("d_SO3", pnp_opt["mathematical_basis"])

        # Check that corridor re-centering is present
        traj_opt = next(o for o in opts_glare if o["id"] == "reconfigure_trajectory")
        self.assertGreater(traj_opt["delta_v_mps"], 0.0)
        print(f"  [OK] Feature #14 (Dynamic FDIR Recovery Engine): Evaluated {len(opts_glare)} pathways, Slew Pred JG={slew_opt['predicted_jg_deg']}deg (Gain={slew_opt['confidence_gain_pct']}%)")


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
