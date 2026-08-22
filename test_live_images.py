import urllib.request
import json
import base64
import time
import os

images = [
    ('Image 1 (Tango Close Range)', r'C:\Users\athar\.gemini\antigravity-ide\brain\e6bb7cf1-3cf0-4791-b086-72889f6e0752\.user_uploaded\media_1787076518601.png'),
    ('Image 2 (Tango Medium Approach)', r'C:\Users\athar\.gemini\antigravity-ide\brain\e6bb7cf1-3cf0-4791-b086-72889f6e0752\.user_uploaded\media_1787076525068.png'),
    ('Image 3 (Tango Far Range)', r'C:\Users\athar\.gemini\antigravity-ide\brain\e6bb7cf1-3cf0-4791-b086-72889f6e0752\.user_uploaded\media_1787076530071.png'),
]

for label, p in images:
    print('======================================================================')
    print(f'TESTING REAL SPEED+ FRAME: {label}')
    print('======================================================================')
    with open(p, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    
    payload = json.dumps({'image': b64}).encode('utf-8')
    req = urllib.request.Request('http://localhost:8000/api/perception/frame', data=payload, headers={'Content-Type': 'application/json'})
    
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    
    model = data.get('model')
    backbone = data.get('backbone')
    inf_ms = data.get('inference_ms', 0.0)
    t_vec = data.get('t', [0, 0, 0])
    q_vec = data.get('quaternion', [1, 0, 0, 0])
    r_mag = (sum(x**2 for x in t_vec))**0.5
    jg = data.get('jensen_gain', 0.0)
    conf = data.get('confidence_level', 'unknown')
    ood = data.get('ood_distance', 0.0)
    is_in_dist = data.get('is_in_distribution', True)
    pnp_agree = data.get('cross_estimator_agreement')
    rot_diff = data.get('rotation_disagreement_deg', 0.0)
    phys_agree = data.get('physics_consistent', True)
    residual = data.get('physics_residual_m', 0.0)
    
    print(f'  [PERCEPTION] Model: {model} ({backbone}) | Latency: {inf_ms:.1f}ms')
    print(f'    - Translation t (m):  {t_vec}')
    print(f'    - Quaternion q:       {q_vec}')
    print(f'    - Range (m):          {r_mag:.2f}m')
    print(f'    - Jensen Gain:        {jg:.2f} deg ({conf.upper()})')
    print(f'    - OOD Score:          {ood:.2f} (In-Dist: {is_in_dist})')
    print(f'    - Cross-PnP Agree:    {pnp_agree} (Disagreement: {rot_diff:.1f} deg)')
    print(f'    - Physics Residual:   {residual:.2f}m (Consistent: {phys_agree})')
    
    cog = data.get('cognition', {})
    print(f'  [COGNITION] Anomaly: {cog.get("anomaly_detected")} | Type: {cog.get("anomaly_type")} ({cog.get("anomaly_severity")})')
    print(f'    - Recommended:        {cog.get("recommended_action")} (Confidence: {cog.get("action_confidence", 0.0):.2f})')
    print(f'    - Root Cause:         {cog.get("root_cause")}')
    print(f'    - Explanation:        {cog.get("explanation")}')
    
    act = data.get('action', {})
    print(f'  [ACTION DIGITAL TWIN] Candidate: {act.get("primary_action")} (Score: {act.get("primary_score", 0.0):.2f})')
    print(f'    - Collision Prob:     {act.get("collision_prob", 0.0):.3f} (99% Clopper-Pearson Bound: {act.get("collision_prob_upper_bound_99", 0.0):.3f})')
    print(f'    - Mission Success:    {act.get("mission_success_prob", 0.0):.3f}')
    print(f'    - Horizon & MC Runs:  {act.get("simulation_horizon_s")}s, {act.get("mc_runs")} rollouts')
    
    con = data.get('consensus', {})
    print(f'  [CONSENSUS ENGINE] Final Decision: {con.get("final_action")} (Consensus: {con.get("consensus_reached")})')
    print(f'    - Votes:              {con.get("votes")}')
    print(f'    - Autonomy Ladder:    {con.get("required_autonomy_level")}')
    print(f'    - Reasoning:          {con.get("reasoning")}\n')
