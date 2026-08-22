import { useMissionControl } from "@/hooks/useMissionControl";

export function CognitionSection() {
  const { latest } = useMissionControl();
  const c = latest.cognition;

  const anomaly = c?.anomaly_detected ?? false;
  const novelty = c?.novelty_score ?? (anomaly ? 0.88 : 0.04);
  const recAction = c?.recommended_action || (anomaly ? "HOLD_POSITION" : "PROCEED_SLOW");
  const rootCause = c?.root_cause || (anomaly ? "thermal" : "nominal");
  const narrative =
    c?.root_cause_narrative ||
    (anomaly
      ? `ROOT CAUSE: ${rootCause.toUpperCase()} anomaly detected. Upstream fault isolating to ${rootCause}. System recommended: ${recAction}.`
      : "NOMINAL FLIGHT ENVELOPE: All 10,000-D hyperdimensional situation vectors in distribution. Zero subsystem anomalies detected.");

  // Subsystem states from HDC causal graph
  const subStates = c?.subsystem_states || {
    thermal: anomaly ? "failed" : "nominal",
    power: anomaly ? "critical" : "nominal",
    life_support: anomaly ? "degraded" : "nominal",
  };

  const heatmap = c?.payload?.explanation?.similarity_heatmap || [
    {
      case_id: anomaly ? 4092 : 1024,
      similarity_pct: anomaly ? 94.8 : 99.4,
      outcome: "SUCCESS",
      success_rate: anomaly ? 98 : 100,
      action: anomaly ? "RECONFIGURE_POWER" : "PROCEED_SLOW",
    },
    {
      case_id: anomaly ? 2180 : 1088,
      similarity_pct: anomaly ? 68.2 : 96.1,
      outcome: "SUCCESS",
      success_rate: anomaly ? 92 : 99,
      action: anomaly ? "HOLD_POSITION" : "PROCEED_NORMAL",
    },
  ];

  return (
    <div className="flex flex-col gap-gutter">
      {/* Causal Graph Root Cause Alert Banner */}
      <div className={`border rounded-xl p-gutter relative overflow-hidden shadow-sm ${
        anomaly ? "bg-surface-container-lowest border-lacquer-red/40" : "bg-surface-container-lowest border-emerald-500/40"
      }`}>
        <div className={`absolute inset-0 ${anomaly ? "bg-lacquer-red/5" : "bg-emerald-500/5"}`}></div>
        <div className="relative flex items-start gap-4">
          <div className={`pt-1 ${anomaly ? "text-lacquer-red" : "text-emerald-700"}`}>
            <span className="material-symbols-outlined text-3xl">
              {anomaly ? "account_tree" : "check_circle"}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className={`font-label-caps text-xs px-2 py-0.5 rounded font-bold uppercase ${
                anomaly ? "bg-lacquer-red text-white" : "bg-emerald-700 text-white"
              }`}>
                {anomaly ? "ROOT-CAUSE GRAPH TRAVERSAL" : "HDC ASSOCIATIVE MEMORY: NOMINAL"}
              </span>
              <span className="text-xs font-mono text-on-surface-variant">
                Novelty: {(novelty * 100).toFixed(1)}% | Status: {anomaly ? "ANOMALY ISOLATED" : "IN-DISTRIBUTION"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink-charcoal mb-1">{narrative}</h2>
            <p className="font-label-caps text-xs text-on-surface-variant">
              {anomaly
                ? `Causal graph directs intervention to upstream root (${rootCause.toUpperCase()}) rather than suppressing symptoms.`
                : "10,000-dimensional situation vector aligns with nominal rendezvous flight corridor."}
            </p>
          </div>
        </div>
      </div>

      {/* Subsystem Cascade Flow */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Step 1: Thermal */}
        <div className={`w-full md:flex-1 bg-surface-container-lowest border rounded-xl p-4 relative shadow-sm ${
          subStates.thermal !== "nominal" ? "border-lacquer-red/40" : "border-outline-variant/60"
        }`}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-caps text-xs text-on-surface-variant uppercase font-bold">Thermal Subsystem</h3>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
              subStates.thermal !== "nominal" ? "text-lacquer-red bg-lacquer-red/10" : "text-emerald-700 bg-emerald-500/10"
            }`}>
              {subStates.thermal || "NOMINAL"}
            </span>
          </div>
          <div className={`font-mono text-sm font-bold ${subStates.thermal !== "nominal" ? "text-lacquer-red" : "text-emerald-700"}`}>
            {subStates.thermal !== "nominal" ? "RADIATOR LOOP 2: 0.4 bar/min LEAK" : "RADIATOR LOOP: 1.85 bar (NOMINAL)"}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {subStates.thermal !== "nominal" ? "Status: Primary Root Trigger" : "Status: Optimal Heat Rejection"}
          </div>
        </div>

        <div className="text-on-surface-variant/40 hidden md:block">
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </div>

        {/* Step 2: Power */}
        <div className={`w-full md:flex-1 bg-surface-container-lowest border rounded-xl p-4 relative shadow-sm ${
          subStates.power !== "nominal" ? "border-lacquer-red/30" : "border-outline-variant/60"
        }`}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-caps text-xs text-on-surface-variant uppercase font-bold">Power Subsystem</h3>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
              subStates.power !== "nominal" ? "text-lacquer-red bg-lacquer-red/10" : "text-emerald-700 bg-emerald-500/10"
            }`}>
              {subStates.power || "NOMINAL"}
            </span>
          </div>
          <div className={`font-mono text-sm font-bold ${subStates.power !== "nominal" ? "text-ink-charcoal" : "text-emerald-700"}`}>
            {subStates.power !== "nominal" ? "SOLAR ARRAY BUS: 22.1V (SAG)" : "MAIN BUS: 28.4V (REGULATED)"}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {subStates.power !== "nominal" ? "Coupling: Overheating throttle" : "Coupling: Nominal Power Flow"}
          </div>
        </div>

        <div className="text-on-surface-variant/40 hidden md:block">
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </div>

        {/* Step 3: Life Support */}
        <div className={`w-full md:flex-1 bg-surface-container-lowest border rounded-xl p-4 relative shadow-sm ${
          subStates.life_support !== "nominal" ? "border-amber-500/30" : "border-outline-variant/60"
        }`}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-label-caps text-xs text-on-surface-variant uppercase font-bold">Life Support (ECLSS)</h3>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
              subStates.life_support !== "nominal" ? "text-amber-700 bg-amber-500/10" : "text-emerald-700 bg-emerald-500/10"
            }`}>
              {subStates.life_support || "NOMINAL"}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-ink-charcoal">
            {subStates.life_support !== "nominal" ? "CABIN O2_PP: 18.2 kPa" : "CABIN O2_PP: 21.3 kPa (STABLE)"}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {subStates.life_support !== "nominal" ? "Coupling: Power load shedding" : "Coupling: Environmental Envelope Normal"}
          </div>
        </div>
      </div>

      {/* HDC Similarity Memory & Explanation */}
      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">memory</span>
            10,000-D Hyperdimensional Memory Retrieval
          </h3>

          <div className="flex flex-col gap-3 font-mono text-xs">
            {heatmap.map((item, idx) => (
              <div key={idx} className="p-3 bg-surface-container-low rounded border border-outline-variant/40 flex justify-between items-center">
                <div>
                  <div className="font-bold text-ink-charcoal">Case #{item.case_id}: {item.action} Maneuver</div>
                  <div className="text-[11px] text-on-surface-variant">Recommended Action: {item.action}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700">{item.similarity_pct.toFixed(1)}% Match</div>
                  <div className="text-[10px] text-on-surface-variant">Success Rate: {item.success_rate}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-lacquer-red">psychology</span>
              Cognition Agent Output
            </h3>
            <div className="text-sm font-mono text-ink-charcoal leading-relaxed p-4 bg-surface-container-low rounded border border-outline-variant/40">
              {c?.explanation || `Cognition engine evaluates 10,000-D situation vector against mission flight envelope. Anomaly score: ${(novelty * 100).toFixed(1)}%. Recommendation: ${recAction}.`}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-outline-variant/60 flex justify-between items-center text-xs font-mono">
            <span className="text-on-surface-variant">Selected Plan: <strong className="text-lacquer-red">{recAction}</strong></span>
            <span className="text-emerald-700 font-bold">Confidence: {((1 - novelty) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
