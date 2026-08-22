# DEMO.md — How to Demo SYMBIOSIS

## For Judges: 60-Second Quick Demo

1. **Open the live dashboard**: https://spacecraft-autonomy-222404104450.us-central1.run.app
2. **Click the rocket** to enter Mission Control
3. **Click "▶ Replay"** in the controls bar
4. **Watch the pipeline in real-time:**
   - Frame 1: Spacecraft at 50m, high confidence → all agents agree → PROCEED_SLOW
   - Frame 2: **Jensen Gain spikes to 22.7°** (solar glare) → system detects symmetry ambiguity → auto-HOLD
   - Escalation alert appears → system refuses to dock
   - **Armstrong Override**: Commander confirms visual → system resumes
   - Frame 3: Perception recovers → PROCEED_NORMAL
5. **Show the SPEED+ v2 Benchmark Evaluator** (Middle panel):
   - Select **Case #2 (SunLAMP 1000W Specular Glare)** → click **"⚡ Evaluate"**
   - See the real-time **ESA/Stanford Pose Score**, $e_t$ (m), $e_R$ (deg), and official NASA Flight Grade
   - See the **3D Tango satellite wireframe HUD** (11 keypoints + solar array wings) projected onto the optical canvas
6. **Point out the NASA Flight Corridor & TAM 12-Thruster Bus** (Left panel):
   - 20° Line-of-Sight Approach Cone clearance margin
   - Real-time Range-Rate velocity vs Max Safe envelope ($v_{actual}$ vs $v_{allowed}$)
   - Dynamic TAM 12-Thruster firing duty cycles ($[u_1 ... u_{12}]$) and $\Delta V$ propellant budget
   - 4-Node Thermal Gradient (Avionics, Battery, Radiator -42°C, Optical Payload)
7. **Simulate Deep Space Network (DSN) Latency**:
   - Change DSN Sim from `LEO (25ms)` to `Mars Ops (14.2 min)`
   - Show how the AI governs the mission with Level 4 Autonomy and cryptographically logs decisions during blackout
8. **Point out the HDC Influence chart** in the Cognition panel — shows exactly *why* the system decided to hold (70% uncertainty influence)
9. **Ask "explain" in the chat** → system explains its last decision in natural language

## For Running Locally

### Prerequisites
- Python 3.10+
- Git LFS installed (`git lfs install`)

### Setup
```bash
git clone https://github.com/atharv1909/spacecraft_autonomy.git
cd spacecraft_autonomy
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements_web.txt
git lfs pull  # Downloads the 101MB ResNet-50 checkpoint
```

### Run
```bash
python interface/app.py
```
Open http://localhost:8000

### What Works Without the Model
- **Replay Demo** (pre-baked data, no model needed)
- **Inject buttons** (manually push perception/cognition data)
- **Orchestrator** start/stop
- **Scenario simulations** (if Redis is running)
- **Chat assistant**
- **Override panel** (Armstrong Protocol)

### What Requires the Model
- **Camera capture** (live webcam → ResNet-50 inference)
- **Image upload** (file → inference)

### Running Tests
```bash
# Full FARAWAY safety suite (8 features)
python -m pytest test_faraway_safety_suite.py -v

# Jensen Gain + Hopf Grid
python -m perception.test_jensen_gain

# Full 5-agent pipeline (requires model + test images)
python integration.py
```

## Key Demo Talking Points

1. **"The system knows when it doesn't know."** Jensen Gain monitors prediction stability across rotations — if the model is confused by symmetry, the spacecraft holds.

2. **"Every decision is explainable."** The HDC component influence chart shows exactly what drove each decision (pose, anomaly, uncertainty, mission phase).

3. **"Humans stay in the loop."** Armstrong Protocol allows 4 levels of override, and the system *learns* from human decisions.

4. **"Safety is mathematically guaranteed."** Clopper-Pearson 99% upper bounds on collision probability — not Monte Carlo point estimates.

5. **"Every decision is tamper-proof."** SHA-256 hash-chained audit log — any modification to the decision record is cryptographically detectable.

## API Endpoints for Live Demo

| Endpoint | What It Shows |
|---|---|
| `/api/health` | All agent statuses at a glance |
| `/api/docs` | Interactive Swagger UI |
| `/api/replay/docking_approach` | Trigger the full replay demo |
| `/api/audit/verify` | Verify the hash-chained decision log |
| `/api/config/thresholds` | Jensen Gain threshold configuration |
