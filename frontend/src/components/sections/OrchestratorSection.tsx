import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMissionControl } from "@/hooks/useMissionControl";
import { startOrchestrator, stopOrchestrator, sendHumanOverride } from "@/lib/api";
import {
  badgeClasses,
  deriveBadge,
  fetchRecoveryOptions,
  simulateTripwire,
  emergencyAbort,
  type RecoveryOptionsResponse,
} from "@/lib/armstrong";
import { TiltCard } from "@/components/motion/TiltCard";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section 5 — the entry point to the Armstrong Protocol.
 *
 * Override routing, per the protocol's own escalation ladder:
 *   L1 Acknowledge   inline, no navigation — accept the AI recommendation.
 *   L2 Modify        opens the Armstrong Console wizard.
 *   L3 Replace       same wizard; the level only changes what is logged.
 *   L4 Abort         inline confirm modal, never the wizard.
 *
 * The recovery pathway grid below reads /api/recovery/options — the same
 * flight-director call the wizard's step 1 reads — so the two surfaces show
 * one dataset rather than two hand-maintained copies.
 */
export function OrchestratorSection() {
  const { latest, status } = useMissionControl();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryOptionsResponse | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [abortOpen, setAbortOpen] = useState(false);

  const cons = latest.consensus;
  const finalAction = cons?.final_action || "—";
  const autoLevel = cons?.required_autonomy_level || "AUTONOMOUS";
  const isOrchRunning = status?.orchestrator_running || false;

  const loadRecovery = useCallback(async () => {
    try {
      setRecovery(await fetchRecoveryOptions());
      setRecoveryError(null);
    } catch (e: any) {
      setRecoveryError(e?.message || "Flight director unreachable");
    }
  }, []);

  useEffect(() => {
    loadRecovery();
    const id = setInterval(loadRecovery, 8000);
    return () => clearInterval(id);
  }, [loadRecovery]);

  const badges = useMemo(() => {
    const opts = recovery?.options ?? [];
    const map = new Map<string, ReturnType<typeof deriveBadge>>();
    for (const o of opts) map.set(o.id, deriveBadge(o, opts));
    return map;
  }, [recovery]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleOrchestrator = async () => {
    setLoading(true);
    try {
      if (isOrchRunning) {
        await stopOrchestrator();
        flash("Orchestrator paused");
      } else {
        await startOrchestrator();
        flash("Orchestrator started");
      }
    } finally {
      setLoading(false);
    }
  };

  // L1 stays inline — an acknowledgement changes nothing about the maneuver,
  // so making the operator walk a three-step wizard for it would be noise.
  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await sendHumanOverride(
        "acknowledge",
        cons?.final_action || "proceed_slow",
        overrideNote.trim() || "Commander acknowledged the autonomous recommendation without change.",
      );
      setOverrideNote("");
      flash("Level 1 acknowledgement logged");
    } finally {
      setLoading(false);
    }
  };

  // L2 and L3 share one flow — the level only decides what gets logged at
  // commit — so it travels as a handoff value rather than a route param.
  const openConsole = (level: "modify" | "replace") => {
    try {
      sessionStorage.setItem("armstrong:level", level);
    } catch {
      // Private-mode storage failure just means the console opens at L2.
    }
    navigate({ to: "/armstrong/pathway" });
  };

  return (
    <div className="grid grid-cols-12 gap-gutter">
      {/* ── Left column ─────────────────────────────────────── */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm">
          <header className="flex flex-wrap justify-between items-center gap-3 mb-6">
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
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 hover:bg-emerald-500/20"
                  : "bg-surface-container border-outline-variant text-ink-charcoal hover:bg-surface-container-high"
              }`}
            >
              {isOrchRunning ? "ORCHESTRATOR: ACTIVE" : "START ORCHESTRATOR"}
            </button>
          </header>

          <div className="grid grid-cols-3 gap-6 w-full mb-6">
            {[
              ["Perception", "30%", cons?.votes?.["perception"], "text-moss-accent", "border-outline-variant"],
              ["Cognition", "40%", cons?.votes?.["cognition"], "text-lacquer-red", "border-lacquer-red/40"],
              ["Action", "30%", cons?.votes?.["action"], "text-ink-charcoal", "border-outline-variant"],
            ].map(([label, weight, vote, tone, border]) => (
              <div key={label as string} className="flex flex-col items-center gap-2">
                <div className="text-center">
                  <div className="font-label-caps text-xs font-bold text-on-surface uppercase">{label}</div>
                  <div className="font-mono text-[11px] text-on-surface-variant">Weight: {weight}</div>
                </div>
                <div className={`w-full bg-surface-container-low px-3 py-2.5 border ${border} rounded-lg flex justify-center items-center`}>
                  <span className={`font-mono text-xs font-bold ${tone} truncate`}>
                    {(vote as string) || "awaiting"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 flex flex-wrap justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">
                Arbitrated Decision
              </div>
              <div className="font-telemetry-lg text-xl font-bold text-lacquer-red font-mono">
                {finalAction}
              </div>
              <div className="text-xs text-on-surface-variant mt-1 line-clamp-3">
                {cons?.reasoning || "Awaiting a consensus message on the orchestrator bus."}
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-surface-container font-bold text-on-surface shrink-0">
              {cons?.consensus_reached ? "UNANIMOUS" : "SAFETY RESOLVED"}
            </span>
          </div>
        </section>

        {/* ── Recovery pathways — same source as the wizard ── */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div>
              <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-lacquer-red">alt_route</span>
                Certified Recovery Pathways
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {recovery
                  ? `${recovery.pathways_count} pathways computed by the FDIR flight director · ${recovery.flight_phase.replace(/_/g, " ")} · JG ${recovery.current_jensen_gain.toFixed(2)}°`
                  : "Loading flight director…"}
              </p>
            </div>
            <div className="flex gap-2">
              {(["optical_glare", "corridor_departure", "sensor_anomaly"] as const).map((t) => (
                <button
                  key={t}
                  onClick={async () => {
                    await simulateTripwire(t);
                    await loadRecovery();
                    flash(`Tripwire injected: ${t.replace(/_/g, " ")}`);
                  }}
                  className="px-2.5 py-1.5 rounded border border-outline-variant text-[10px] font-mono font-bold text-on-surface-variant hover:border-lacquer-red hover:text-lacquer-red transition-colors cursor-pointer"
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {recovery?.tripwire_triggered && (
            <div className="mb-4 p-3 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-lacquer-red shrink-0">crisis_alert</span>
              <span className="font-mono text-[11px] text-lacquer-red leading-relaxed">
                {recovery.tripwire_reason}
              </span>
            </div>
          )}

          {recoveryError ? (
            <div className="p-6 text-center font-mono text-xs text-lacquer-red">{recoveryError}</div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(recovery?.options ?? []).map((opt, i) => {
                const badge = badges.get(opt.id) ?? "ALTERNATIVE";
                return (
                  <Reveal key={opt.id} from="up" delay={i * 45}>
                    <TiltCard
                      maxTilt={5}
                      lift={8}
                      onClick={() => openConsole("modify")}
                      ariaLabel={`Open the Armstrong Console at ${opt.title}`}
                      className="h-full rounded-lg border border-outline-variant/70 bg-surface-container-low p-3.5 flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                            {opt.icon}
                          </span>
                          <h4 className="font-headline-sm text-xs font-bold text-ink-charcoal leading-snug">
                            {opt.title}
                          </h4>
                        </div>
                        <span
                          className={`shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${badgeClasses(badge)}`}
                        >
                          {badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-ink-charcoal/75 flex-1 mb-3 line-clamp-4">
                        {opt.plain_explanation}
                      </p>
                      <dl className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-outline-variant/50 font-mono text-[10px]">
                        <div>
                          <dt className="text-[8px] uppercase text-on-surface-variant">ΔV</dt>
                          <dd className="font-bold text-ink-charcoal">{opt.delta_v_mps.toFixed(3)}</dd>
                        </div>
                        <div>
                          <dt className="text-[8px] uppercase text-on-surface-variant">JG</dt>
                          <dd className="font-bold text-ink-charcoal">{opt.predicted_jg_deg.toFixed(1)}°</dd>
                        </div>
                        <div>
                          <dt className="text-[8px] uppercase text-on-surface-variant">Gain</dt>
                          <dd className={`font-bold ${opt.confidence_gain_pct < 0 ? "text-lacquer-red" : "text-moss-accent"}`}>
                            {opt.confidence_gain_pct > 0 ? "+" : ""}
                            {opt.confidence_gain_pct}%
                          </dd>
                        </div>
                      </dl>
                    </TiltCard>
                  </Reveal>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Autonomy ladder ─────────────────────────────── */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">stairs</span>
            Graduated Autonomy Ladder
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs mb-4">
            {[
              ["Level 0", "AUTONOMOUS", "JG < 10°, In-Dist", autoLevel === "AUTONOMOUS", "emerald"],
              ["Level 1", "ACKNOWLEDGE", "JG 10°-20°", autoLevel === "acknowledge", "amber"],
              ["Level 2", "MODIFY", "JG 20°-30°", autoLevel === "modify", "orange"],
              ["Level 3/4", "REPLACE", "OOD / Physics Jump", autoLevel === "replace" || autoLevel === "reject", "red"],
            ].map(([level, name, cond, active, tone]) => (
              <div
                key={level as string}
                className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                  active
                    ? tone === "emerald"
                      ? "bg-emerald-500/15 border-emerald-500/50 font-bold"
                      : tone === "amber"
                        ? "bg-amber-500/15 border-amber-500/50 font-bold"
                        : tone === "orange"
                          ? "bg-orange-500/15 border-orange-500/50 font-bold"
                          : "bg-lacquer-red/15 border-lacquer-red/50 font-bold"
                    : "bg-surface-container-low border-outline-variant/40 opacity-70"
                }`}
              >
                <div className="text-[10px] uppercase">{level}</div>
                <div className="mt-1">{name}</div>
                <div className="text-[10px] text-on-surface-variant mt-1">{cond}</div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-surface-container-low rounded border border-outline-variant/40 text-xs font-mono text-on-surface-variant">
            Active Reason:{" "}
            {cons?.autonomy_reasons?.length
              ? cons.autonomy_reasons.join(" | ")
              : "Evidence metrics within the nominal autonomous threshold envelope."}
          </div>
        </section>
      </div>

      {/* ── Right column: the four override levels ───────── */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter shadow-sm flex flex-col h-full">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">shield_with_heart</span>
            Armstrong Protocol Overrides
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            Levels 2 and 3 open the console, where you choose a pathway and tune its real command
            parameters. Levels 1 and 4 act from here.
          </p>

          {toast && (
            <div className="mb-3 p-2.5 rounded bg-moss-accent/10 border border-moss-accent/40 font-mono text-[11px] text-moss-accent font-bold">
              {toast}
            </div>
          )}

          <label
            htmlFor="l1-note"
            className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1.5"
          >
            Level 1 acknowledgement note
          </label>
          <input
            id="l1-note"
            type="text"
            placeholder="Optional — logged with the acknowledgement"
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            className="w-full text-xs font-mono p-2.5 mb-4 rounded bg-surface-container border border-outline-variant text-ink-charcoal focus:outline-none focus:border-lacquer-red"
          />

          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <button
              onClick={handleAcknowledge}
              disabled={loading}
              className="w-full p-3 rounded bg-surface-container border border-outline-variant hover:border-amber-600 hover:text-amber-800 transition-colors text-left flex justify-between items-center font-bold cursor-pointer disabled:opacity-50"
            >
              <span>
                L1: ACKNOWLEDGE
                <span className="block font-normal text-[10px] text-on-surface-variant mt-0.5">
                  Accept the recommendation as-is — applies immediately
                </span>
              </span>
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </button>

            <button
              onClick={() => openConsole("modify")}
              className="w-full p-3 rounded bg-surface-container border border-outline-variant hover:border-orange-600 hover:text-orange-800 transition-colors text-left flex justify-between items-center font-bold cursor-pointer"
            >
              <span>
                L2: MODIFY BOUNDS
                <span className="block font-normal text-[10px] text-on-surface-variant mt-0.5">
                  Open the console and retune the active maneuver
                </span>
              </span>
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>

            <button
              onClick={() => openConsole("replace")}
              className="w-full p-3 rounded bg-surface-container border border-outline-variant hover:border-lacquer-red hover:text-lacquer-red transition-colors text-left flex justify-between items-center font-bold cursor-pointer"
            >
              <span>
                L3: REPLACE ACTION
                <span className="block font-normal text-[10px] text-on-surface-variant mt-0.5">
                  Open the console and choose a different pathway
                </span>
              </span>
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
            </button>

            <button
              onClick={() => setAbortOpen(true)}
              className="w-full p-3 rounded bg-lacquer-red text-white hover:bg-primary transition-colors text-left flex justify-between items-center font-bold shadow-sm cursor-pointer"
            >
              <span>
                L4: EMERGENCY ABORT
                <span className="block font-normal text-[10px] opacity-90 mt-0.5">
                  Retreat to standoff — requires typed confirmation
                </span>
              </span>
              <span className="material-symbols-outlined text-[20px]">emergency</span>
            </button>
          </div>

          <div className="mt-auto pt-4 border-t border-outline-variant/60 text-[11px] font-mono text-on-surface-variant">
            Every operator override is cryptographically timestamped and appended to the SHA-256
            decision ledger with its rationale.
          </div>
        </section>
      </div>

      <InlineAbortDialog
        open={abortOpen}
        onClose={() => setAbortOpen(false)}
        onDone={(msg) => {
          setAbortOpen(false);
          flash(msg);
        }}
      />
    </div>
  );
}

/**
 * L4 from the dashboard. Same contract as the console's abort modal — typed
 * confirmation plus a mandatory rationale — but reachable without entering the
 * wizard, because an abort should never be three clicks deep.
 */
function InlineAbortDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [rationale, setRationale] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRationale("");
      setConfirmText("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const ok = rationale.trim().length >= 12 && confirmText.trim().toUpperCase() === "CONFIRM";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-charcoal/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency abort confirmation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-paper-surface rounded-2xl border-2 border-lacquer-red shadow-2xl overflow-hidden">
        <header className="px-6 py-4 bg-lacquer-red text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px]">emergency</span>
          <div>
            <h2 className="font-headline-sm text-base font-bold uppercase tracking-wide">
              Level 4 — Emergency Abort
            </h2>
            <p className="font-mono text-[11px] opacity-90">This action is irreversible.</p>
          </div>
        </header>

        <div className="p-6 flex flex-col gap-5">
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            placeholder="Engineering rationale — appended verbatim to the SHA-256 audit chain (12 characters minimum)."
            className="w-full text-sm font-mono p-3 rounded-lg bg-surface-container border border-outline-variant text-ink-charcoal focus:outline-none focus:border-lacquer-red resize-none"
          />
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            placeholder="Type CONFIRM"
            className="w-full text-sm font-mono p-3 rounded-lg bg-surface-container border border-outline-variant text-ink-charcoal focus:outline-none focus:border-lacquer-red tracking-[0.2em]"
          />
          {error && (
            <div className="p-3 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-xs text-lacquer-red">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 bg-surface-container border-t border-outline-variant flex justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-outline-variant font-label-caps text-[11px] uppercase tracking-wider font-bold text-ink-charcoal hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const res = await emergencyAbort({ rationale: rationale.trim(), operator: "commander" });
                onDone(`Emergency abort committed · ${res.entry_hash.slice(0, 12)}…`);
              } catch (e: any) {
                setError(e?.message || "The abort command was rejected.");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={!ok || submitting}
            className="px-6 py-2.5 rounded-lg bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-wider font-bold hover:bg-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Transmitting…" : "Transmit Abort"}
          </button>
        </footer>
      </div>
    </div>
  );
}
