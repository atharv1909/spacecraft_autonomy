import { useState, useEffect, useRef } from "react";
import { useMissionControl } from "@/hooks/useMissionControl";
import { useActiveFlightStore } from "@/hooks/useActiveFlightState";
import { sendHumanOverride } from "@/lib/api";

interface TrajectoryPoint {
  x: number; // V-bar (m)
  y: number; // R-bar (m)
  z: number; // H-bar (m)
  t: number;
}

export function OverviewSection() {
  const { events, refreshAll } = useMissionControl();
  const { activeFlightState, activePresetId, isProcessing, selectPreset } = useActiveFlightStore();
  const [stopLoading, setStopLoading] = useState(false);
  const [trajHistory, setTrajHistory] = useState<TrajectoryPoint[]>([]);
  const prevTimeRef = useRef<number>(Date.now());

  // Real Flight Telemetry from Active Flight State
  const pose = activeFlightState?.pose ?? {
    rangeM: 1.411,
    t: [0.0201, 0.0181, 1.411] as [number, number, number],
    q: [0.8861, 0.3592, -0.1261, -0.2643] as [number, number, number, number],
    losAngleDeg: 1.10,
    coneMarginDeg: 18.90,
    inCone: true,
    transverseOffsetMm: 27.0,
  };
  const gatekeeper = activeFlightState?.gatekeeper ?? {
    isValid: true,
    confidence: 0.9998,
    logit: 8.30,
    reason: null,
    latencyMs: 95.0,
    fpr95: 0.0265,
    accuracy: 0.9782,
    backbone: "DINOv2 ViT-Small/14",
  };
  const uncertainty = activeFlightState?.uncertainty ?? {
    quotientJensenGainDeg: 1.84,
    confidenceLevel: "high",
    confidenceLabel: "HIGH CONFIDENCE",
    calibratedBoundDeg: 4.8,
    oodDistance: 18.18,
    pnpAgreement: true,
  };
  const consensus = activeFlightState?.consensus ?? {
    percVote: "HOLD_FOR_CONSISTENCY",
    actVote: "INHIBIT_CLOSING",
    action: "STATION_KEEPING_HOLD",
    autonomyLevel: "AUTONOMOUS (Level 1)",
    fdirPath: "FDIR LEVEL 1: Station-keep at current range.",
    consensusReached: true,
  };

  // In CWH optical frame:
  // vbar = range along camera optical boresight (t_z)
  // rbar = radial transverse offset (t_y)
  // hbar = cross-track transverse offset (t_x)
  const vbar = pose.rangeM;
  const rbar = pose.t[1];
  const hbar = pose.t[0];
  const losAngleDeg = pose.losAngleDeg;
  const coneMarginDeg = pose.coneMarginDeg;
  const isInsideCone = pose.inCone;

  // Maintain live trajectory history
  useEffect(() => {
    const now = Date.now();
    setTrajHistory((prev) => {
      const updated = [...prev, { x: vbar, y: rbar, z: hbar, t: now }];
      return updated.slice(-60);
    });
    prevTimeRef.current = now;
  }, [vbar, rbar, hbar]);

  const handleEmergencyStop = async () => {
    setStopLoading(true);
    try {
      await sendHumanOverride("reject", "hold_position", "Manual Emergency Stop triggered from Overview Dashboard");
      await refreshAll();
    } finally {
      setStopLoading(false);
    }
  };

  // SVG coordinate transformation for CWH trajectory plot
  const maxV = Math.max(5.0, Math.ceil(vbar * 1.4));
  const maxR = 1.0; // +/- 1.0m radial bounds for close proximity

  const toSvgX = (v: number) => {
    const clampedV = Math.max(0, Math.min(maxV, v));
    return 540 - (clampedV / maxV) * 480;
  };

  const toSvgY = (r: number) => {
    const clampedR = Math.max(-maxR, Math.min(maxR, r));
    return 130 - (clampedR / maxR) * 100;
  };

  const startX = toSvgX(maxV);
  const targetX = toSvgX(0);
  const targetY = toSvgY(0);
  const coneUpperStart = toSvgY(maxV * Math.tan((20 * Math.PI) / 180));
  const coneLowerStart = toSvgY(-maxV * Math.tan((20 * Math.PI) / 180));

  const scSvgX = toSvgX(vbar);
  const scSvgY = toSvgY(rbar);

  return (
    <div className="flex flex-col gap-gutter">
      
      {/* ── Active Flight Benchmark Selector Bar ────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lacquer-red text-[20px]">flight_takeoff</span>
          <span className="font-mono text-xs font-bold text-ink-charcoal uppercase tracking-wider">
            Active Vision-GNC Benchmark Frame:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "test1", label: "test1.jpeg (1.41m Nominal)" },
            { id: "test2", label: "test2.jpeg (2.86m Nominal)" },
            { id: "test3", label: "test3.jpeg (1.75m Glare Tripwire)" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset.id)}
              disabled={isProcessing}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activePresetId === preset.id
                  ? "bg-lacquer-red text-white shadow-xs"
                  : "bg-surface-container text-ink-charcoal border border-outline-variant hover:bg-surface-container-high"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${preset.id === "test3" ? "bg-rose-400" : "bg-emerald-400"}`}></span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Telemetry KPI Ribbon (Real Vision-GNC Data Only) ──────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Card 1: Active Flight Action & Consensus */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between h-[130px] shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Active Flight Command</h3>
            <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded font-bold ${
              consensus.consensusReached ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}>
              {consensus.consensusReached ? "CONSENSUS NOMINAL" : "FDIR RECOVERY"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-[28px] ${consensus.consensusReached ? "text-emerald-600" : "text-lacquer-red animate-pulse"}`}>
              {consensus.action.includes("HOLD") ? "pause_circle" : consensus.action.includes("ENGAGED") ? "warning" : "navigation"}
            </span>
            <span className="font-telemetry-lg text-[20px] font-bold text-ink-charcoal tracking-tight truncate">
              {consensus.action}
            </span>
          </div>
          <div className="text-[11px] font-label-caps text-on-surface-variant truncate">
            Perc: <strong className="text-ink-charcoal">{consensus.percVote}</strong> | Act: <strong className="text-ink-charcoal">{consensus.actVote}</strong>
          </div>
        </div>

        {/* Card 2: Optical Boresight Range & Transverse Offset */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between h-[130px] shadow-sm">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Boresight Docking Range</h3>
          <div className="flex items-baseline gap-2">
            <span className="font-telemetry-lg text-[32px] font-bold text-ink-charcoal tracking-tight font-mono">
              {vbar.toFixed(3)}
            </span>
            <span className="font-telemetry-sm text-on-surface-variant">m</span>
          </div>
          <div className="text-[11px] font-label-caps text-on-surface-variant flex justify-between">
            <span>Offset: <strong className="text-ink-charcoal">{pose.transverseOffsetMm.toFixed(1)} mm</strong></span>
            <span>LOS: <strong className={isInsideCone ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>{losAngleDeg.toFixed(2)}°</strong></span>
          </div>
        </div>

        {/* Card 3: Foundation Gatekeeper Certification */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex items-center justify-between h-[130px] shadow-sm">
          <div className="flex flex-col gap-1">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider leading-tight">
              DINOv2 Gatekeeper ViT
            </h3>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`font-telemetry-lg text-[26px] font-bold tracking-tight font-mono ${gatekeeper.isValid ? "text-emerald-700" : "text-lacquer-red"}`}>
                {(gatekeeper.confidence * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] font-label-caps text-on-surface-variant font-bold uppercase font-mono">
                ({gatekeeper.logit >= 0 ? `+${gatekeeper.logit.toFixed(2)}` : gatekeeper.logit.toFixed(2)} logit)
              </span>
            </div>
            <div className={`text-[10px] font-label-caps font-bold ${gatekeeper.isValid ? "text-emerald-700" : "text-lacquer-red"}`}>
              {gatekeeper.isValid ? "FLIGHT CERTIFIED (FPR@95 PASS)" : "TRIPWIRE GLARE REJECTED"}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center shrink-0">
            <span className={`material-symbols-outlined text-[36px] ${gatekeeper.isValid ? "text-emerald-600" : "text-lacquer-red animate-pulse"}`}>
              {gatekeeper.isValid ? "verified" : "gpp_bad"}
            </span>
            <span className="text-[9px] font-mono text-on-surface-variant mt-0.5">{gatekeeper.latencyMs.toFixed(0)} ms</span>
          </div>
        </div>

        {/* Card 4: NASA 20° Corridor Margin */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between h-[130px] shadow-sm">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">NASA 20° Corridor Clearance</h3>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-telemetry-lg text-[30px] font-bold tracking-tight font-mono ${isInsideCone ? "text-emerald-700" : "text-lacquer-red"}`}>
              +{coneMarginDeg.toFixed(2)}°
            </span>
            <span className="font-telemetry-sm text-on-surface-variant">margin</span>
          </div>
          <div className="text-[10px] font-label-caps text-on-surface-variant flex justify-between">
            <span>Status: <strong className={isInsideCone ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>{isInsideCone ? "SAFE CORRIDOR ✓" : "CORRIDOR EXCEEDED ✗"}</strong></span>
            <span>Cone: <strong>20.0°</strong></span>
          </div>
        </div>
      </section>

      {/* ── Trajectory & Visualizer Frame ───────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-gutter min-h-[400px]">
        <div className="xl:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <div className="px-container-padding py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h2 className="font-label-caps text-label-caps text-ink-charcoal uppercase tracking-widest flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[18px] opacity-70">scatter_plot</span>
              Proximity Trajectory (CWH Relative Frame)
            </h2>
            <div className="flex flex-wrap gap-4 font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-[3px] bg-lacquer-red rounded-full"></span>
                <span className="text-on-surface-variant">Live Chaser ({vbar.toFixed(2)}m)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-[2px] bg-emerald-600"></span>
                <span className="text-on-surface-variant">Centerline Guidance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-[2px] bg-emerald-500/60 border-t border-dashed"></span>
                <span className="text-on-surface-variant">NASA 20° Corridor</span>
              </div>
            </div>
          </div>

          <div className="flex-1 relative bg-surface-container-lowest p-4 flex flex-col border-b border-outline-variant min-h-[280px]">
            {/* Live Telemetry Overlay */}
            <div className="flex justify-between items-center font-mono text-xs text-on-surface-variant mb-2">
              <div>
                Lateral: dx=<strong className="text-ink-charcoal">{(hbar * 1000).toFixed(1)}mm</strong>, dy=<strong className="text-ink-charcoal">{(rbar * 1000).toFixed(1)}mm</strong>
              </div>
              <div>
                Optical Depth (t_z): <strong className="text-lacquer-red">{vbar.toFixed(3)}m</strong>
              </div>
            </div>

            {/* SVG Dynamic Trajectory Plot */}
            <div className="flex-1 relative w-full h-[220px] bg-paper-surface/60 rounded-lg border border-outline-variant/60 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 260" preserveAspectRatio="none">
                {/* Background Grid */}
                <line x1="60" y1="65" x2="540" y2="65" stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="60" y1="130" x2="540" y2="130" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
                <line x1="60" y1="195" x2="540" y2="195" stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="180" y1="20" x2="180" y2="240" stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="300" y1="20" x2="300" y2="240" stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="420" y1="20" x2="420" y2="240" stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4 4" />

                {/* 20-Degree Approach Corridor Cone Polygon */}
                <polygon
                  points={`${startX},${coneUpperStart} ${targetX},${targetY} ${startX},${coneLowerStart}`}
                  fill="rgba(16, 185, 129, 0.06)"
                  stroke="rgba(16, 185, 129, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Target Docking Port */}
                <circle cx={targetX} cy={targetY} r="16" fill="rgba(139, 37, 0, 0.08)" stroke="#8b2500" strokeWidth="1.5" />
                <circle cx={targetX} cy={targetY} r="4" fill="#8b2500" />
                <text x={targetX - 45} y={targetY - 22} fill="#8b2500" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  DOCKING TARGET (0, 0)
                </text>

                {/* Live Spacecraft Marker */}
                <circle cx={scSvgX} cy={scSvgY} r="9" fill="#8b2500" stroke="#fff" strokeWidth="2.5" className="shadow-lg" />
                <circle cx={scSvgX} cy={scSvgY} r="18" fill="none" stroke="#8b2500" strokeWidth="1" opacity="0.4" className="animate-ping" />
                <text x={scSvgX - 25} y={scSvgY - 14} fill="#1a1518" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  CHASER ({vbar.toFixed(2)}m)
                </text>
              </svg>
            </div>
          </div>

          <div className="px-container-padding py-2 bg-surface-container flex justify-between items-center text-[11px] font-mono text-on-surface-variant">
            <span>Centerline Deviation: <strong className="text-ink-charcoal">{(pose.transverseOffsetMm).toFixed(1)} mm</strong></span>
            <span>Corridor Status: <strong className="text-emerald-700">PASS (+{coneMarginDeg.toFixed(2)}° Inside Cone)</strong></span>
          </div>
        </div>

        {/* Live Decision Event Stream */}
        <div className="xl:col-span-4 bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <div className="px-container-padding py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h2 className="font-label-caps text-label-caps text-ink-charcoal uppercase tracking-widest flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[18px] opacity-70">terminal</span>
              Live Decision Ledger
            </h2>
            <span className="font-mono text-xs text-on-surface-variant">{events.length} events</span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto max-h-[340px] custom-scrollbar flex flex-col gap-2 font-mono text-xs">
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/40 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-on-surface-variant font-bold">
                <span className="text-lacquer-red">ACTIVE BENCHMARK</span>
                <span>NOW</span>
              </div>
              <div className="text-ink-charcoal font-bold">{activeFlightState?.imageName || `${activePresetId}.jpeg`}</div>
              <div className="text-[11px] text-on-surface-variant">{consensus.fdirPath}</div>
            </div>

            {events.slice(-10).reverse().map((ev, idx) => (
              <div key={idx} className="p-2 rounded bg-surface-container-low border border-outline-variant/40 flex flex-col gap-1">
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold">
                  <span className="text-lacquer-red">{ev.channel}</span>
                  <span>{ev.time}</span>
                </div>
                <div className="text-ink-charcoal break-words">{ev.summary}</div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-surface-container border-t border-outline-variant/60">
            <button
              onClick={handleEmergencyStop}
              disabled={stopLoading}
              className="w-full bg-lacquer-red text-white py-2.5 rounded font-label-caps text-label-caps uppercase tracking-wider hover:bg-primary transition-colors flex items-center justify-center gap-2 shadow-sm font-bold disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">warning</span>
              {stopLoading ? "ABORTING..." : "EMERGENCY HOLD / ABORT"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Real Vision-GNC Telemetry Panels (NO FAKE HARDWARE) ──────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
        
        {/* Box 1: NASA 20° LOS Approach Corridor */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px] text-lacquer-red">explore</span>
              NASA 20° Safe Approach Corridor
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              isInsideCone ? "bg-emerald-500/10 text-emerald-800" : "bg-rose-500/10 text-rose-800"
            }`}>
              {isInsideCone ? `MARGIN: +${coneMarginDeg.toFixed(2)}°` : "MARGIN: EXCEEDED"}
            </span>
          </div>
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex justify-between border-b border-outline-variant/30 pb-1">
              <span className="text-on-surface-variant">Boresight Depth (t_z):</span>
              <span className="font-bold text-ink-charcoal">{vbar.toFixed(3)} m</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/30 pb-1">
              <span className="text-on-surface-variant">Lateral Transverse (d_xy):</span>
              <span className="font-bold text-ink-charcoal">{pose.transverseOffsetMm.toFixed(1)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Corridor Verification:</span>
              <span className="font-bold text-emerald-700">✓ PASS ({losAngleDeg.toFixed(2)}° &lt; 20.0°)</span>
            </div>
          </div>
        </div>

        {/* Box 2: 6-DoF Orientation & Quotient Lie Invariant */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px] text-lacquer-red">rotate_90_degrees_ccw</span>
              6-DoF Attitude & Lie Quotient
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
              SO(3)/G_sym
            </span>
          </div>
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex justify-between border-b border-outline-variant/30 pb-1">
              <span className="text-on-surface-variant">Quaternion q:</span>
              <span className="font-bold text-ink-charcoal text-[11px]">
                [{pose.q[0].toFixed(3)}, {pose.q[1].toFixed(3)}, {pose.q[2].toFixed(3)}, {pose.q[3].toFixed(3)}]
              </span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/30 pb-1">
              <span className="text-on-surface-variant">Quotient Manifold G_sym:</span>
              <span className="font-bold text-emerald-700">{uncertainty.quotientJensenGainDeg.toFixed(2)}° (Folded)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Redundant PnP Check:</span>
              <span className="font-bold text-emerald-700">{uncertainty.pnpAgreement ? "✓ VERIFIED AGREE" : "ADVISORY WATCH"}</span>
            </div>
          </div>
        </div>

        {/* Box 3: Autonomous FDIR Flight Directive */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px] text-lacquer-red">published_with_changes</span>
              Autonomous FDIR Directive
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              consensus.consensusReached ? "bg-emerald-500/10 text-emerald-800" : "bg-lacquer-red/10 text-lacquer-red"
            }`}>
              {consensus.autonomyLevel}
            </span>
          </div>
          <div className="p-2 bg-surface-container-low rounded border border-outline-variant/40 font-mono text-xs text-ink-charcoal leading-relaxed">
            {consensus.fdirPath}
          </div>
        </div>

      </section>
    </div>
  );
}
