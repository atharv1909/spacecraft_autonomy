import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { useMissionControl } from "@/hooks/useMissionControl";
import { sendHumanOverride } from "@/lib/api";

export type IncidentType =
  | "optical_glare"
  | "thermal_cascade"
  | "corridor_drift"
  | "comm_dropout";

interface RecoveryStep {
  id: number;
  label: string;
  action: string;
  durationMs: number;
  description: string;
  telemetryEffect: string;
  status: "pending" | "executing" | "completed" | "failed";
}

interface IncidentConfig {
  id: IncidentType;
  title: string;
  genericError: string;
  rootCause: string;
  subsystem: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  initialMetric: string;
  recoverySummary: string;
  steps: Array<Omit<RecoveryStep, "status">>;
}

const INCIDENTS: Record<IncidentType, IncidentConfig> = {
  optical_glare: {
    id: "optical_glare",
    title: "Specular Solar Glare & Pose Ambiguity",
    genericError: "FATAL ERROR 502: Neural Pose Estimator Disagree — Tracking Lost",
    rootCause: "High-intensity solar vector directly reflecting off target docking ring into primary camera aperture.",
    subsystem: "Optical Navigation (Layer 1 Gatekeeper / Layer 2 PoseNet)",
    severity: "CRITICAL",
    initialMetric: "Jensen Gain: 71.08° (Threshold: ≤15.0°)",
    recoverySummary: "Execute autonomous 15° camera roll away from sun line, crosscheck with ORB+EPnP secondary tracker, and re-sample Lie group invariant features.",
    steps: [
      {
        id: 1,
        label: "Fault Isolation & Safe Hold",
        action: "FREEZE_VELOCITY_VECTOR",
        durationMs: 1200,
        description: "Inhibit +V-bar closing thrusters. Hold chaser at 12.5m station-keeping gate.",
        telemetryEffect: "Relative velocity clamped to 0.00 m/s. Range fixed at 12.50m.",
      },
      {
        id: 2,
        label: "Attitude Off-Sun Slew (-15° Roll)",
        action: "EXECUTE_ATTITUDE_SLEW",
        durationMs: 1800,
        description: "Fire RCS thruster pairs T3/T7 to roll chaser by -15.0° along boresight axis to eliminate specular flare.",
        telemetryEffect: "Solar reflection angle shifted by 18.2°. Glare saturation dropped from 94% to 8%.",
      },
      {
        id: 3,
        label: "Redundant PnP & Star Tracker Crosscheck",
        action: "ENGAGE_REDUNDANT_SOLVER",
        durationMs: 1400,
        description: "Re-acquire 3D pose using geometric EPnP solver and secondary infrared sensor.",
        telemetryEffect: "ORB feature count: 342. Pose rotation difference with MEKF: 0.84°.",
      },
      {
        id: 4,
        label: "Conformal Uncertainty Re-Verification",
        action: "CALCULATE_JENSEN_GAIN",
        durationMs: 1500,
        description: "Re-sample 16 Lie group in-plane perturbations to verify rotation consistency.",
        telemetryEffect: "Jensen Gain collapsed from 71.08° to 2.41°. 95% error bound ≤ 4.2°.",
      },
      {
        id: 5,
        label: "Consensus Restored & Resume Approach",
        action: "RESUME_PROCEED_SLOW",
        durationMs: 1200,
        description: "Multi-agent consensus reaches 3/3 unanimous vote. Resume nominal closing at 0.02 m/s.",
        telemetryEffect: "Autonomy Level 0 (Autonomous) restored. Safe corridor margin: +18.6°.",
      },
    ],
  },
  thermal_cascade: {
    id: "thermal_cascade",
    title: "Radiator Loop Leak & Avionics Thermal Sag",
    genericError: "FATAL ERROR 504: Avionics Subsystem Degraded — Power Overload",
    rootCause: "Radiator loop 2 coolant micro-leak (0.4 bar/min) causing main bus voltage drop and battery overheating.",
    subsystem: "Thermal & Electrical Power Subsystem (EPS)",
    severity: "HIGH",
    initialMetric: "Radiator Pressure: 0.4 bar | Bus Temp: 58.4°C",
    recoverySummary: "Isolate Radiator Loop 2, re-route vital avionics to Loop 1, shed non-essential ECLSS heating loads, and throttle solar array bus.",
    steps: [
      {
        id: 1,
        label: "Root-Cause Causal Isolation",
        action: "ISOLATE_THERMAL_LOOP_2",
        durationMs: 1200,
        description: "HDC causal graph isolates upstream trigger to Radiator Loop 2 valve rather than downstream battery symptoms.",
        telemetryEffect: "Loop 2 isolation valve CLOSED. Coolant loss rate arrested.",
      },
      {
        id: 2,
        label: "Power Load Re-Routing",
        action: "CROSS_CONNECT_BUS_1",
        durationMs: 1600,
        description: "Re-route primary navigation and telemetry processors to Main Power Bus 1 (28.4V regulated).",
        telemetryEffect: "Avionics supply voltage stabilized to 28.2V. Bus current drawn: 14.1A.",
      },
      {
        id: 3,
        label: "Non-Critical Load Shedding",
        action: "SHED_ECLSS_HEATERS",
        durationMs: 1400,
        description: "Temporarily shed auxiliary cabin heaters and secondary payload bay thermal coils.",
        telemetryEffect: "Thermal dissipation requirement reduced by 380W. Battery temp declining: -0.8°C/min.",
      },
      {
        id: 4,
        label: "Equilibrium Confirmation",
        action: "VERIFY_THERMAL_STEADY_STATE",
        durationMs: 1500,
        description: "10,000-D situation vector matches Case #4092 with 94.8% cosine similarity.",
        telemetryEffect: "Battery temperature stabilized at 31.2°C (Safe limit: <45°C).",
      },
      {
        id: 5,
        label: "Mission Authorization",
        action: "PROCEED_SLOW_THERMAL_GUARD",
        durationMs: 1200,
        description: "Authorize continued proximity operations with thermal throttle limiter active.",
        telemetryEffect: "FDIR status: RESOLVED. Action agent selected RECONFIGURE_POWER.",
      },
    ],
  },
  corridor_drift: {
    id: "corridor_drift",
    title: "Thruster Imbalance & 20° LOS Corridor Drift",
    genericError: "FATAL ERROR 508: Trajectory Violation — Approach Boundary Exceeded",
    rootCause: "Cross-track RCS thruster T4 duty cycle offset causing radial drift outside NASA 20.0° line-of-sight cone.",
    subsystem: "Guidance, Navigation & Control (GNC / CWH Flight Dynamics)",
    severity: "HIGH",
    initialMetric: "LOS Angle: 24.8° (Exceeded 20.0° Cone Limit)",
    recoverySummary: "Execute dynamic CWH glissade correction, fire counter-radial thrusters T8/T12, and re-converge into central 5° glide path.",
    steps: [
      {
        id: 1,
        label: "Corridor Drift Detection",
        action: "CWH_CORRIDOR_CLAMP",
        durationMs: 1100,
        description: "Line-of-sight angle exceeds 20.0° NASA approach envelope. Trigger automatic trajectory clamp.",
        telemetryEffect: "Clearance margin: -4.8° (VIOLATION). Range rate throttled to 0.01 m/s.",
      },
      {
        id: 2,
        label: "Counter-Radial Impulse Burn",
        action: "FIRE_RCS_T8_T12",
        durationMs: 1700,
        description: "Command 120ms pulsed burn on RCS thrusters T8 and T12 to generate -0.04 m/s radial velocity.",
        telemetryEffect: "Radial velocity v_r shifted from +0.038 m/s to -0.012 m/s.",
      },
      {
        id: 3,
        label: "Clohessy-Wiltshire State Re-Convergence",
        action: "PROPAGATE_CWH_GLISSADE",
        durationMs: 1600,
        description: "Forward-propagate 60-second CWH state transition matrix to verify docking axis intercept.",
        telemetryEffect: "Future closest point of approach: 0.12m from port center. Collision probability: 0.0001.",
      },
      {
        id: 4,
        label: "Re-Entry into 20° Safe Cone",
        action: "VERIFY_CONE_MARGIN",
        durationMs: 1400,
        description: "Vehicle cross-track position returns within ±0.4m corridor boundary.",
        telemetryEffect: "LOS angle reduced to 4.2° (Well within 20.0° cone. Clearance margin: +15.8°).",
      },
      {
        id: 5,
        label: "Approach Glide Re-Engaged",
        action: "RESUME_DOCKING_GLISSADE",
        durationMs: 1200,
        description: "12-Thruster Allocation Matrix rebalanced. Docking glissade nominal.",
        telemetryEffect: "TAM duty cycles nominal. Approach glissade re-engaged at 0.03 m/s.",
      },
    ],
  },
  comm_dropout: {
    id: "comm_dropout",
    title: "Deep Space Ground Communication Dropout",
    genericError: "FATAL ERROR 500: Ground Telemetry Lost — System Freezing",
    rootCause: "Planetary occultation or deep space antenna misalignment creating complete ground blackout.",
    subsystem: "Telecommunications & Autonomy Escalation Manager",
    severity: "MODERATE",
    initialMetric: "Ground Delay: ∞ (Connection Severed)",
    recoverySummary: "Escalate to Armstrong Level 0 autonomous authority, execute cryptographic append-only state checkpointing, and continue nominal fail-safe glissade.",
    steps: [
      {
        id: 1,
        label: "Loss-of-Signal (LOS) Detection",
        action: "ENGAGE_AUTONOMOUS_AUTHORITY",
        durationMs: 1000,
        description: "Ground link heartbeat lost. System switches from ground-supervised to full onboard autonomy.",
        telemetryEffect: "Armstrong Protocol escalated to Level 0 (Full Onboard Autonomous Authority).",
      },
      {
        id: 2,
        label: "Cryptographic State Snapshot",
        action: "SHA256_STATE_CHECKPOINT",
        durationMs: 1300,
        description: "Generate tamper-evident SHA-256 hash snapshot of full multi-agent sensor states.",
        telemetryEffect: "State hash chained to local ledger: 8f4a1c... (Verified).",
      },
      {
        id: 3,
        label: "Autonomous Safety Margin Check",
        action: "MONTE_CARLO_SAFETY_CHECK",
        durationMs: 1500,
        description: "Execute 100-rollout CWH Monte Carlo simulation with Clopper-Pearson exact 99% safety bound.",
        telemetryEffect: "99% collision probability upper bound: 0.0448 (Complies with NASA safety flight envelope).",
      },
      {
        id: 4,
        label: "Autonomous 10m Hold Position Gate",
        action: "ENTER_SAFE_HOLD_GATE",
        durationMs: 1400,
        description: "Guide chaser to 10.0m safe hold position to await optical target alignment.",
        telemetryEffect: "Range stabilized at 10.00m ± 0.05m. Zero drift relative to Tango port.",
      },
      {
        id: 5,
        label: "Fail-Safe Station Keeping",
        action: "MAINTAIN_PASSIVE_ABORT_VECTOR",
        durationMs: 1200,
        description: "Maintain passive opening drift trajectory in event of secondary failures.",
        telemetryEffect: "Passive safe drift vector confirmed. Station-keeping verified.",
      },
    ],
  },
};

export function RecoveryWorkflowSection() {
  const { latest, refreshAll } = useMissionControl();
  const [selectedIncident, setSelectedIncident] = useState<IncidentType>("optical_glare");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [scrubbedTime, setScrubbedTime] = useState<number>(35);
  const [viewMode, setViewMode] = useState<"trajectory" | "uncertainty" | "thermal">("trajectory");

  const incident = INCIDENTS[selectedIncident];

  // Dynamic interactive data for Recharts Graphs
  const chartData = useMemo(() => {
    const data = [];
    for (let t = 0; t <= 90; t += 2) {
      // Nominal baseline
      const nominalAngle = Math.max(2.0, 18.0 - t * 0.2);
      
      // Unmitigated Error Path (Diverging out of control)
      let unmitigatedAngle = 18.0;
      let unmitigatedJensen = 2.8;
      let unmitigatedTemp = 28.0;
      let unmitigatedRange = Math.max(0, 15.0 - t * 0.18);
      
      if (t >= 10) {
        if (selectedIncident === "optical_glare") {
          unmitigatedJensen = Math.min(88.0, 71.08 + (t - 10) * 0.3);
          unmitigatedAngle = Math.min(38.0, 16.0 + (t - 10) * 0.35);
        } else if (selectedIncident === "corridor_drift") {
          unmitigatedAngle = Math.min(42.0, 18.0 + (t - 10) * 0.45);
          unmitigatedJensen = 14.0 + (t - 10) * 0.2;
        } else if (selectedIncident === "thermal_cascade") {
          unmitigatedTemp = Math.min(74.0, 32.0 + (t - 10) * 0.65);
          unmitigatedJensen = 8.0 + (t - 10) * 0.15;
        } else {
          unmitigatedAngle = 18.0 + (t - 10) * 0.1;
          unmitigatedJensen = 4.0;
        }
      }

      // Mitigated Autonomous Recovery Path (Re-converging)
      let recoveredAngle = unmitigatedAngle;
      let recoveredJensen = unmitigatedJensen;
      let recoveredTemp = unmitigatedTemp;
      let recoveredRange = 15.0 - t * 0.08;

      // Recovery intervention happens between T=20 and T=50
      if (t >= 20) {
        const progress = Math.min(1.0, (t - 20) / 30);
        
        if (selectedIncident === "optical_glare") {
          recoveredJensen = 71.08 * (1 - progress) + 2.41 * progress;
          recoveredAngle = Math.max(3.5, 18.0 * (1 - progress) + 4.2 * progress);
        } else if (selectedIncident === "corridor_drift") {
          recoveredAngle = 24.8 * (1 - progress) + 4.2 * progress;
          recoveredJensen = 16.0 * (1 - progress) + 2.8 * progress;
        } else if (selectedIncident === "thermal_cascade") {
          recoveredTemp = 58.4 * (1 - progress) + 31.2 * progress;
          recoveredJensen = 12.0 * (1 - progress) + 2.6 * progress;
        } else {
          recoveredAngle = 18.0 * (1 - progress) + 4.0 * progress;
          recoveredJensen = 2.82;
        }
      }

      data.push({
        time: t,
        nominalAngle: Number(nominalAngle.toFixed(2)),
        unmitigatedAngle: Number(unmitigatedAngle.toFixed(2)),
        recoveredAngle: Number(recoveredAngle.toFixed(2)),
        unmitigatedJensen: Number(unmitigatedJensen.toFixed(2)),
        recoveredJensen: Number(recoveredJensen.toFixed(2)),
        unmitigatedTemp: Number(unmitigatedTemp.toFixed(2)),
        recoveredTemp: Number(recoveredTemp.toFixed(2)),
        corridorUpper: 20.0,
        corridorLower: -20.0,
        jensenThreshold: 15.0,
        tempSafeLimit: 45.0,
        range: Number(Math.max(0.5, recoveredRange).toFixed(2)),
      });
    }
    return data;
  }, [selectedIncident]);

  // Current active data point at scrubbed time
  const currentDataPoint = useMemo(() => {
    return chartData.find((d) => d.time >= scrubbedTime) || chartData[0];
  }, [chartData, scrubbedTime]);

  // Switch Incident
  const handleSelectIncident = (type: IncidentType) => {
    setSelectedIncident(type);
    setCurrentStepIndex(0);
    setIsExecuting(false);
    setExecutionLog([`Incident selected: ${INCIDENTS[type].title}. Ready for FDIR recovery path.`]);
    if (type === "thermal_cascade") setViewMode("thermal");
    else if (type === "optical_glare") setViewMode("uncertainty");
    else setViewMode("trajectory");
  };

  // Step-by-step Auto Executor
  useEffect(() => {
    let timeout: any = null;
    if (isExecuting && currentStepIndex < incident.steps.length) {
      const step = incident.steps[currentStepIndex];
      timeout = setTimeout(() => {
        setExecutionLog((prev) => [
          `[T+${(currentStepIndex + 1) * 8}s] COMPLETED: ${step.label} -> ${step.telemetryEffect}`,
          ...prev.slice(0, 8),
        ]);
        setScrubbedTime((prev) => Math.min(90, prev + 14));
        setCurrentStepIndex((prev) => prev + 1);
      }, step.durationMs);
    } else if (isExecuting && currentStepIndex >= incident.steps.length) {
      setIsExecuting(false);
      setExecutionLog((prev) => [
        `✓ AUTONOMOUS FDIR RECOVERY COMPLETE: All safety envelopes nominal. Resumed autonomous rendezvous.`,
        ...prev,
      ]);
      sendHumanOverride("L1", "PROCEED_SLOW", "Autonomous FDIR recovery completed successfully.");
      refreshAll();
    }
    return () => clearTimeout(timeout);
  }, [isExecuting, currentStepIndex, incident, refreshAll]);

  const handleStartAutoRecovery = () => {
    setCurrentStepIndex(0);
    setScrubbedTime(10);
    setIsExecuting(true);
    setExecutionLog([
      `Initiating Autonomous FDIR Multi-Stage Recovery for: ${incident.title}...`,
    ]);
  };

  const handleNextStep = () => {
    if (currentStepIndex < incident.steps.length) {
      const step = incident.steps[currentStepIndex];
      setExecutionLog((prev) => [
        `[Manual Step ${currentStepIndex + 1}] EXECUTED: ${step.label} -> ${step.telemetryEffect}`,
        ...prev,
      ]);
      setScrubbedTime((prev) => Math.min(90, prev + 16));
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleReset = () => {
    setIsExecuting(false);
    setCurrentStepIndex(0);
    setScrubbedTime(15);
    setExecutionLog([`Workflow reset. Initial state restored.`]);
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── Top Incident Selector Bar ────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-lacquer-red animate-pulse"></span>
              <span className="font-label-caps text-xs text-lacquer-red font-bold uppercase tracking-wider">
                Autonomous Fault Detection, Isolation & Recovery (FDIR)
              </span>
            </div>
            <h2 className="text-xl font-bold text-ink-charcoal">
              Recoverable Error Workflow Engine
            </h2>
            <p className="text-xs font-mono text-on-surface-variant mt-0.5">
              Replaces unhandled fatal exceptions with structured multi-agent convergence branches and real-time validation.
            </p>
          </div>

          {/* Scenario Tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(INCIDENTS) as IncidentType[]).map((type) => {
              const inc = INCIDENTS[type];
              const isSelected = selectedIncident === type;
              return (
                <button
                  key={type}
                  onClick={() => handleSelectIncident(type)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? "bg-lacquer-red text-white border-lacquer-red shadow-md scale-102"
                      : "bg-surface-container-low text-ink-charcoal border-outline-variant/60 hover:bg-surface-container hover:border-lacquer-red/40"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {type === "optical_glare"
                      ? "wb_sunny"
                      : type === "thermal_cascade"
                      ? "thermostat"
                      : type === "corridor_drift"
                      ? "navigation"
                      : "signal_cellular_connected_no_internet_0_bar"}
                  </span>
                  {inc.title.split("&")[0].trim()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Comparison Banner: Generic Error vs. SYMBIOSIS Recovery Path ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Left: What Standard Systems Do (Generic Fatal Error) */}
        <div className="bg-surface-container-lowest border border-rose-500/40 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 px-3 py-1 bg-rose-600/10 border-b border-l border-rose-500/30 rounded-bl-xl text-[10px] font-mono text-rose-700 font-bold uppercase">
            Conventional Autonomy (Generic Error)
          </div>
          <div className="flex items-start gap-3 mt-2">
            <div className="p-2.5 bg-rose-500/10 text-rose-700 rounded-xl">
              <span className="material-symbols-outlined text-2xl">error</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink-charcoal">
                Generic Fatal Crash / Hard Abort
              </h3>
              <div className="mt-2 p-2.5 bg-rose-500/5 rounded border border-rose-500/20 font-mono text-xs text-rose-800">
                {incident.genericError}
              </div>
              <p className="text-xs text-on-surface-variant mt-2.5 leading-relaxed">
                Standard AI lacks self-awareness: freezes state, halts control loops, and causes mission loss when ground telemetry latency is 20+ minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Right: What SYMBIOSIS Does (Recoverable Autonomous Workflow) */}
        <div className="bg-surface-container-lowest border border-emerald-500/50 rounded-2xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/10 border-b border-l border-emerald-500/30 rounded-bl-xl text-[10px] font-mono text-emerald-700 font-bold uppercase">
            SYMBIOSIS (Recoverable Error Path)
          </div>
          <div className="flex items-start gap-3 mt-2">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-700 rounded-xl">
              <span className="material-symbols-outlined text-2xl">published_with_changes</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink-charcoal">
                Root-Cause Isolation & Multi-Stage Auto-Recovery
              </h3>
              <div className="mt-2 p-2.5 bg-emerald-500/5 rounded border border-emerald-500/20 font-mono text-xs text-emerald-800">
                {incident.recoverySummary}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-on-surface-variant">
                  Initial Violation: <strong className="text-lacquer-red">{incident.initialMetric}</strong>
                </span>
                <span className="text-emerald-700 font-bold">
                  Recovery Steps: {incident.steps.length} Phases
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Interactive Recharts Telemetry Section ──────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
          <div>
            <h3 className="font-bold text-base text-ink-charcoal flex items-center gap-2">
              <span className="material-symbols-outlined text-lacquer-red text-[20px]">ssid_chart</span>
              Interactive Recovery Trajectory & Telemetry Verification
            </h3>
            <p className="text-xs font-mono text-on-surface-variant">
              Visualizing the diverging error vector vs. the autonomous convergence path computed via Clohessy-Wiltshire state equations.
            </p>
          </div>

          {/* Graph View Tabs */}
          <div className="flex items-center gap-2 bg-surface-container p-1 rounded-xl border border-outline-variant/60">
            <button
              onClick={() => setViewMode("trajectory")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "trajectory"
                  ? "bg-lacquer-red text-white shadow-xs"
                  : "text-ink-charcoal hover:bg-surface-container-high"
              }`}
            >
              20° LOS Cone Corridor
            </button>
            <button
              onClick={() => setViewMode("uncertainty")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "uncertainty"
                  ? "bg-lacquer-red text-white shadow-xs"
                  : "text-ink-charcoal hover:bg-surface-container-high"
              }`}
            >
              Jensen Gain Spread (G_J)
            </button>
            <button
              onClick={() => setViewMode("thermal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "thermal"
                  ? "bg-lacquer-red text-white shadow-xs"
                  : "text-ink-charcoal hover:bg-surface-container-high"
              }`}
            >
              Subsystem Thermal Re-Balance
            </button>
          </div>
        </div>

        {/* Recharts Component */}
        <div className="w-full h-[320px] bg-surface-container-low rounded-xl p-2 border border-outline-variant/40">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "trajectory" ? (
              <ComposedChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="safeCorridorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" unit="s" stroke="#6e6469" fontSize={11} />
                <YAxis unit="°" domain={[-5, 45]} stroke="#6e6469" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fffdfa",
                    borderColor: "rgba(139,37,0,0.2)",
                    borderRadius: "12px",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "6px" }} />
                
                {/* 20° NASA Line of Sight Corridor Limit */}
                <ReferenceLine y={20.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "NASA 20° Corridor Limit", position: "top", fill: "#ef4444", fontSize: 10 }} />
                <ReferenceArea y1={0} y2={20} fill="url(#safeCorridorGrad)" />
                <ReferenceLine x={scrubbedTime} stroke="#8b2500" strokeWidth={2} label={{ value: `T+${scrubbedTime}s`, position: "insideTopLeft", fill: "#8b2500", fontSize: 11, fontWeight: "bold" }} />

                <Line
                  type="monotone"
                  dataKey="unmitigatedAngle"
                  name="Unmitigated Divergence (Generic Crash)"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="recoveredAngle"
                  name="Autonomous Recovery Path (SYMBIOSIS)"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ r: 2, fill: "#059669" }}
                />
                <Line
                  type="monotone"
                  dataKey="nominalAngle"
                  name="Nominal Planned Glissade"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                />
              </ComposedChart>
            ) : viewMode === "uncertainty" ? (
              <ComposedChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="jensenRecoveryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" unit="s" stroke="#6e6469" fontSize={11} />
                <YAxis unit="°" domain={[0, 90]} stroke="#6e6469" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fffdfa",
                    borderColor: "rgba(139,37,0,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                <ReferenceLine y={15.0} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "15.0° High Confidence Threshold", position: "top", fill: "#d97706", fontSize: 10 }} />
                <ReferenceLine x={scrubbedTime} stroke="#8b2500" strokeWidth={2} label={{ value: `T+${scrubbedTime}s`, fill: "#8b2500", fontSize: 11 }} />

                <Area
                  type="monotone"
                  dataKey="recoveredJensen"
                  name="Jensen Gain (Recovered)"
                  stroke="#059669"
                  fill="url(#jensenRecoveryGrad)"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="unmitigatedJensen"
                  name="Jensen Gain (Unmitigated Glare)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                <XAxis dataKey="time" unit="s" stroke="#6e6469" fontSize={11} />
                <YAxis unit="°C" domain={[20, 80]} stroke="#6e6469" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fffdfa",
                    borderColor: "rgba(139,37,0,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }} />
                <ReferenceLine y={45.0} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "45.0°C Safe Battery Limit", position: "top", fill: "#dc2626", fontSize: 10 }} />
                <ReferenceLine x={scrubbedTime} stroke="#8b2500" strokeWidth={2} label={{ value: `T+${scrubbedTime}s`, fill: "#8b2500", fontSize: 11 }} />

                <Line
                  type="monotone"
                  dataKey="recoveredTemp"
                  name="Stabilized Temperature (FDIR Active)"
                  stroke="#059669"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="unmitigatedTemp"
                  name="Uncontrolled Overheating (Thermal Runaway)"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Live Scrubbing Slider & Instant Readouts */}
        <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/60 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-on-surface-variant font-bold whitespace-nowrap">Timeline Scrubber:</span>
            <input
              type="range"
              min={0}
              max={90}
              value={scrubbedTime}
              onChange={(e) => setScrubbedTime(Number(e.target.value))}
              className="w-full md:w-48 accent-lacquer-red cursor-pointer"
            />
            <span className="font-bold text-ink-charcoal w-14">T+{scrubbedTime}s</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <div>
              <span className="text-on-surface-variant">LOS Angle: </span>
              <strong className={currentDataPoint.recoveredAngle <= 20 ? "text-emerald-700" : "text-lacquer-red"}>
                {currentDataPoint.recoveredAngle}°
              </strong>
            </div>
            <div>
              <span className="text-on-surface-variant">Jensen Gain: </span>
              <strong className={currentDataPoint.recoveredJensen <= 15 ? "text-emerald-700" : "text-lacquer-red"}>
                {currentDataPoint.recoveredJensen}°
              </strong>
            </div>
            <div>
              <span className="text-on-surface-variant">Range: </span>
              <strong className="text-ink-charcoal">{currentDataPoint.range}m</strong>
            </div>
            <div>
              <span className="text-on-surface-variant">Corridor Status: </span>
              <strong className={currentDataPoint.recoveredAngle <= 20 ? "text-emerald-700" : "text-lacquer-red"}>
                {currentDataPoint.recoveredAngle <= 20 ? "CONVERGED ✓" : "CORRIDOR EXCEEDED ✗"}
              </strong>
            </div>
          </div>
        </div>

      </div>

      {/* ── Step-by-Step Interactive Recovery Workflow Stepper ───────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
          <div>
            <h3 className="font-bold text-base text-ink-charcoal flex items-center gap-2">
              <span className="material-symbols-outlined text-lacquer-red text-[20px]">account_tree</span>
              Autonomous Multi-Stage Recovery Stepper
            </h3>
            <p className="text-xs font-mono text-on-surface-variant">
              Live deterministic execution ladder guiding the spacecraft from initial fault isolation to nominal docking glissade.
            </p>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartAutoRecovery}
              disabled={isExecuting}
              className="px-4 py-2 bg-lacquer-red text-white text-xs font-mono font-bold uppercase rounded-xl hover:bg-primary transition-all shadow hover:shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isExecuting ? "autorenew" : "play_arrow"}
              </span>
              {isExecuting ? "Executing..." : "Auto-Run FDIR"}
            </button>
            <button
              onClick={handleNextStep}
              disabled={isExecuting || currentStepIndex >= incident.steps.length}
              className="px-3.5 py-2 bg-surface-container text-ink-charcoal text-xs font-mono font-bold uppercase rounded-xl border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">skip_next</span>
              Single Step
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 bg-surface-container text-on-surface-variant text-xs font-mono font-bold uppercase rounded-xl border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Reset
            </button>
          </div>
        </div>

        {/* Step Nodes DAG */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {incident.steps.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex && isExecuting;
            const isPending = idx > currentStepIndex;

            return (
              <div
                key={step.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between relative ${
                  isDone
                    ? "bg-emerald-500/5 border-emerald-500/40 shadow-xs"
                    : isCurrent
                    ? "bg-lacquer-red/5 border-lacquer-red shadow-md scale-102 ring-2 ring-lacquer-red/20"
                    : "bg-surface-container-low border-outline-variant/60 opacity-70"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-[10px] font-bold text-on-surface-variant">
                      PHASE 0{step.id}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        isDone
                          ? "bg-emerald-500/15 text-emerald-800"
                          : isCurrent
                          ? "bg-lacquer-red text-white animate-pulse"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {isDone ? "COMPLETE ✓" : isCurrent ? "ACTIVE..." : "QUEUED"}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-ink-charcoal leading-snug mb-1">
                    {step.label}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant font-mono leading-relaxed mt-1">
                    {step.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-outline-variant/40 font-mono text-[10px] text-emerald-800">
                  <strong>Outcome:</strong> {step.telemetryEffect}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time Execution Terminal Stream */}
        <div className="p-4 bg-[#1a1518] text-[#f7ece2] rounded-xl border border-outline-variant font-mono text-xs flex flex-col gap-1.5 shadow-inner">
          <div className="flex justify-between items-center text-[11px] text-on-surface-variant border-b border-white/10 pb-2 mb-1">
            <span className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              FDIR RECOVERY LOG BUS
            </span>
            <span>Deterministic SHA-256 Verified Trail</span>
          </div>
          <div className="max-h-28 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
            {executionLog.map((log, idx) => (
              <div key={idx} className="leading-relaxed text-[11px]">
                <span className="text-lacquer-red/80 font-bold">&gt;&gt;</span> {log}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
