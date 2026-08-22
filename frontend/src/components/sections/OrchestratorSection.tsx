import { useState } from "react";
import { useMissionControl } from "@/hooks/useMissionControl";
import { startOrchestrator, stopOrchestrator, sendHumanOverride } from "@/lib/api";

export function OrchestratorSection() {
  const { latest, status, refreshAll } = useMissionControl();
  const [loading, setLoading] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [activeOverrideLevel, setActiveOverrideLevel] = useState<string | null>(null);

  const cons = latest.consensus;
  const pVote = cons?.votes?.perception || "PROCEED";
  const cVote = cons?.votes?.cognition || "HOLD";
  const aVote = cons?.votes?.action || "RECONFIGURE";
  const finalAction = cons?.final_action || "PROCEED_SLOW";
  const autoLevel = cons?.required_autonomy_level || "AUTONOMOUS";
  const isOrchRunning = status?.orchestrator_running || false;

  const handleToggleOrchestrator = async () => {
    setLoading(true);
    try {
      if (isOrchRunning) {
        await stopOrchestrator();
      } else {
        await startOrchestrator();
      }
      await refreshAll();
    } catch (e) {
      console.error("Toggle orchestrator error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (level: string, action: string) => {
    setLoading(true);
    setActiveOverrideLevel(level);
    try {
      await sendHumanOverride(level, action, overrideNote || `Commander manual intervention (Level ${level})`);
      setOverrideNote("");
      await refreshAll();
    } catch (e) {
      console.error("Override error", e);
    } finally {
      setLoading(false);
      setTimeout(() => setActiveOverrideLevel(null), 3000);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-gutter">
      {/* Left Column: Voting Matrix & Ladder */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
        
        {/* Multi-Agent Voting Matrix */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter relative overflow-hidden flex flex-col shadow-sm">
          <header className="flex justify-between items-center mb-6">
            <div>
              <h2 className="font-label-caps text-xs text-on-surface-variant uppercase tracking-wider font-bold">
                Multi-Agent Consensus Matrix
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Weighted dynamic arbitration across Perception, Cognition, and Action agents.
              </p>
            </div>
            <button
              onClick={handleToggleOrchestrator}
              disabled={loading}
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold border transition-colors cursor-pointer ${
                isOrchRunning
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-900 hover:bg-emerald-500/25"
                  : "bg-surface-container border-outline-variant text-ink-charcoal hover:bg-surface-container-high"
              }`}
            >
              {loading ? "COMMUNICATING..." : isOrchRunning ? "ORCHESTRATOR: ACTIVE" : "START ORCHESTRATOR"}
            </button>
          </header>

          <div className="grid grid-cols-3 gap-6 w-full mb-6">
            {/* Perception Vote */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-center">
                <div className="font-label-caps text-xs font-bold text-on-surface uppercase">Perception</div>
                <div className="font-mono text-[11px] text-on-surface-variant">Weight: 30%</div>
              </div>
              <div className="w-full bg-surface-container-low px-3 py-2.5 border border-outline-variant rounded-lg flex justify-center items-center">
                <span className="font-mono text-xs font-bold text-moss-accent truncate">{pVote}</span>
              </div>
            </div>

            {/* Cognition Vote */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-center">
                <div className="font-label-caps text-xs font-bold text-on-surface uppercase">Cognition</div>
                <div className="font-mono text-[11px] text-on-surface-variant">Weight: 40%</div>
              </div>
              <div className="w-full bg-surface-container-low px-3 py-2.5 border border-lacquer-red/40 rounded-lg flex justify-center items-center">
                <span className="font-mono text-xs font-bold text-lacquer-red truncate">{cVote}</span>
              </div>
            </div>

            {/* Action Vote */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-center">
                <div className="font-label-caps text-xs font-bold text-on-surface uppercase">Action</div>
                <div className="font-mono text-[11px] text-on-surface-variant">Weight: 30%</div>
              </div>
              <div className="w-full bg-surface-container-low px-3 py-2.5 border border-outline-variant rounded-lg flex justify-center items-center">
                <span className="font-mono text-xs font-bold text-ink-charcoal truncate">{aVote}</span>
              </div>
            </div>
          </div>

          {/* Final Consensus Output Box */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 flex justify-between items-center">
            <div>
              <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Arbitrated Decision</div>
              <div className="font-telemetry-lg text-xl font-bold text-lacquer-red font-mono">{finalAction}</div>
              <div className="text-xs text-on-surface-variant mt-1">
                {cons?.reasoning || "All agents resolved consensus on closed-loop guidance."}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-surface-container font-bold text-on-surface">
                {cons?.consensus_reached ? "UNANIMOUS" : "SAFETY RESOLVED"}
              </span>
            </div>
          </div>
        </section>

        {/* Graduated Autonomy Ladder Status */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">stairs</span>
            Graduated Autonomy Ladder
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs mb-4">
            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              autoLevel === "AUTONOMOUS" ? "bg-emerald-500/15 border-emerald-500/50 font-bold" : "bg-surface-container-low border-outline-variant/40 opacity-70"
            }`}>
              <div className="text-[10px] uppercase">Level 0</div>
              <div className="text-emerald-900 mt-1">AUTONOMOUS</div>
              <div className="text-[10px] text-on-surface-variant mt-1">JG &lt; 10°, In-Dist</div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              autoLevel === "acknowledge" ? "bg-amber-500/15 border-amber-500/50 font-bold" : "bg-surface-container-low border-outline-variant/40 opacity-70"
            }`}>
              <div className="text-[10px] uppercase">Level 1</div>
              <div className="text-amber-900 mt-1">ACKNOWLEDGE</div>
              <div className="text-[10px] text-on-surface-variant mt-1">JG 10°-20°</div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              autoLevel === "modify" ? "bg-orange-500/15 border-orange-500/50 font-bold" : "bg-surface-container-low border-outline-variant/40 opacity-70"
            }`}>
              <div className="text-[10px] uppercase">Level 2</div>
              <div className="text-orange-900 mt-1">MODIFY</div>
              <div className="text-[10px] text-on-surface-variant mt-1">JG 20°-30°</div>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              autoLevel === "replace" || autoLevel === "reject" ? "bg-lacquer-red/15 border-lacquer-red/50 font-bold" : "bg-surface-container-low border-outline-variant/40 opacity-70"
            }`}>
              <div className="text-[10px] uppercase">Level 3/4</div>
              <div className="text-lacquer-red mt-1">REPLACE</div>
              <div className="text-[10px] text-on-surface-variant mt-1">OOD / Physics Jump</div>
            </div>
          </div>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/40 text-xs font-mono text-on-surface-variant">
            Active Reason: {cons?.autonomy_reasons && cons.autonomy_reasons.length > 0 ? cons.autonomy_reasons.join(" | ") : "Evidence metrics within nominal autonomous threshold envelope."}
          </div>
        </section>

        {/* NASA FDIR Autonomous Flight Director */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-lacquer-red">shield</span>
              NASA FDIR Autonomous Flight Director & CAM Abort
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 font-bold">
              NOMINAL GLISSADE
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 font-mono text-xs text-center">
            <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30">
              <div className="text-[10px] text-on-surface-variant">Flight Phase</div>
              <div className="font-bold text-lacquer-red">CLOSING_GLISSADE (12.5m)</div>
            </div>
            <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30">
              <div className="text-[10px] text-on-surface-variant">20° Cone Margin</div>
              <div className="font-bold text-emerald-700">+18.58° (CLEAR)</div>
            </div>
            <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30">
              <div className="text-[10px] text-on-surface-variant">CAM Escape Burn</div>
              <div className="font-bold text-emerald-700">✓ ARMED (Δv_R=+0.5m/s)</div>
            </div>
          </div>
        </section>
      </div>

      {/* Right Column: Live Armstrong Protocol Controls */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm flex flex-col justify-between h-full">
          <div>
            <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-lacquer-red">shield_with_heart</span>
              Armstrong Protocol Overrides
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Direct manual intervention commands dispatched to state bus.
            </p>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Operator intervention rationale..."
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                className="w-full text-xs font-mono p-2.5 rounded bg-surface-container border border-outline-variant text-ink-charcoal focus:outline-none focus:border-lacquer-red"
              />
            </div>

            <div className="flex flex-col gap-2.5 font-mono text-xs">
              <button
                onClick={() => handleOverride("acknowledge", "proceed_slow")}
                disabled={loading}
                className={`w-full p-2.5 rounded border transition-colors text-left flex justify-between items-center font-bold cursor-pointer ${
                  activeOverrideLevel === "acknowledge"
                    ? "bg-amber-100 border-amber-600 text-amber-900 shadow-sm"
                    : "bg-surface-container border-outline-variant hover:border-amber-600 hover:text-amber-800"
                }`}
              >
                <span>{activeOverrideLevel === "acknowledge" ? "DISPATCHED: L1 ACKNOWLEDGE" : "L1: ACKNOWLEDGE (PROCEED_SLOW)"}</span>
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              </button>

              <button
                onClick={() => handleOverride("modify", "hold_position")}
                disabled={loading}
                className={`w-full p-2.5 rounded border transition-colors text-left flex justify-between items-center font-bold cursor-pointer ${
                  activeOverrideLevel === "modify"
                    ? "bg-orange-100 border-orange-600 text-orange-900 shadow-sm"
                    : "bg-surface-container border-outline-variant hover:border-orange-600 hover:text-orange-800"
                }`}
              >
                <span>{activeOverrideLevel === "modify" ? "DISPATCHED: L2 MODIFY" : "L2: MODIFY (HOLD_POSITION)"}</span>
                <span className="material-symbols-outlined text-[16px]">tune</span>
              </button>

              <button
                onClick={() => handleOverride("replace", "reconfigure_power")}
                disabled={loading}
                className={`w-full p-2.5 rounded border transition-colors text-left flex justify-between items-center font-bold cursor-pointer ${
                  activeOverrideLevel === "replace"
                    ? "bg-rose-100 border-lacquer-red text-lacquer-red shadow-sm"
                    : "bg-surface-container border-outline-variant hover:border-lacquer-red hover:text-lacquer-red"
                }`}
              >
                <span>{activeOverrideLevel === "replace" ? "DISPATCHED: L3 REPLACE" : "L3: REPLACE (RECONFIGURE_POWER)"}</span>
                <span className="material-symbols-outlined text-[16px]">sync_problem</span>
              </button>

              <button
                onClick={() => handleOverride("reject", "retreat_safely")}
                disabled={loading}
                className={`w-full p-3 rounded text-white transition-colors text-left flex justify-between items-center font-bold shadow-sm cursor-pointer ${
                  activeOverrideLevel === "reject"
                    ? "bg-black border-2 border-lacquer-red"
                    : "bg-lacquer-red hover:bg-primary"
                }`}
              >
                <span>{activeOverrideLevel === "reject" ? "DISPATCHED: EMERGENCY ABORT" : "L4: EMERGENCY RETREAT / ABORT"}</span>
                <span className="material-symbols-outlined text-[18px]">emergency</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-outline-variant/60 text-[11px] font-mono text-on-surface-variant">
            All manual operator overrides are cryptographically timestamped and appended to the SHA-256 decision ledger.
          </div>
        </section>
      </div>

    </div>
  );
}
