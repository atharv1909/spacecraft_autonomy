import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMissionControl } from "@/hooks/useMissionControl";
import { formatClock } from "@/lib/armstrong";
import { useArmstrong } from "./ArmstrongContext";
import { StepIndicator, type WizardStep } from "./StepIndicator";
import { EmergencyAbortModal } from "./EmergencyAbortModal";

/**
 * Chrome shared by all three wizard screens.
 *
 * There is deliberately no application navigation here. A focused
 * safety-critical flow should not offer a side door into unrelated sections
 * of the app halfway through a maneuver commit — the only ways out are the
 * dashboard link, the step-back link, and the emergency abort.
 */
export function ArmstrongShell({
  step,
  title,
  children,
  back,
}: {
  step: WizardStep;
  title: string;
  children: ReactNode;
  /** Where the footer's back control goes, and what it says. */
  back: { to: string; label: string };
}) {
  const { session, remaining, expired, committed, loading, error, refreshSession } = useArmstrong();
  const [abortOpen, setAbortOpen] = useState(false);

  // The console is itself a mission-control client: subscribing to the shared
  // telemetry stream for the duration of the flow is what makes the review
  // step's "Crew Notified" gate mean something. Without a live subscriber the
  // gate would fail for every operator, which is worse than not checking.
  const { wsConnected: busLive, latest } = useMissionControl();

  // A consensus change mid-flow should re-read the session so the
  // situation-changed banner can fire against the new state.
  const consensusTs = (latest.consensus as { timestamp?: number } | null)?.timestamp;
  useEffect(() => {
    if (consensusTs) refreshSession();
  }, [consensusTs, refreshSession]);

  const liveAction = (latest.consensus as { final_action?: string } | null)?.final_action;
  const consensusAction =
    liveAction?.toUpperCase() ??
    (session?.snapshot.tripwire_triggered ? "HOLD_POSITION" : (session?.snapshot.flight_phase ?? "—"));

  const urgent = !committed && remaining > 0 && remaining < 60;

  return (
    <div className="min-h-screen bg-paper-surface text-ink-charcoal font-body-md flex flex-col selection:bg-lacquer-red selection:text-white">
      {/* Cherry-blossom wash, same layer the dashboard uses */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none opacity-[0.18]"
        style={{ backgroundImage: "url('/sakura-bg.jpg')" }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-paper-surface/80 via-paper-surface/60 to-paper-surface/95" />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-paper-surface/95 backdrop-blur-md border-b border-outline-variant/60">
        <div className="max-w-[1240px] mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link
            to="/mission"
            className="flex items-center gap-2 text-on-surface-variant hover:text-lacquer-red transition-colors font-label-caps text-[11px] uppercase tracking-widest font-bold shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="hidden sm:inline">Mission Control</span>
          </Link>

          <span className="font-headline-md font-bold tracking-[0.2em] uppercase text-sm text-lacquer-red truncate">
            Armstrong Console
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant font-mono text-[11px] font-bold"
              title={busLive ? "Attached to the live telemetry bus" : "Telemetry bus not reachable"}
            >
              <span
                className={`w-2 h-2 rounded-full ${busLive ? "bg-moss-accent animate-pulse" : "bg-lacquer-red"}`}
              />
              {consensusAction}
            </span>
            <Countdown seconds={remaining} urgent={urgent} committed={committed} compact />
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <main className="flex-1 relative z-10 w-full max-w-[1240px] mx-auto px-5 py-7 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-[30px] md:text-[40px] leading-tight font-bold tracking-tight text-ink-charcoal">
            {title}
          </h1>
        </div>

        <StepIndicator current={step} />

        {loading && !session ? (
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
              <span className="font-mono text-xs">Opening Armstrong session…</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-sm text-lacquer-red">
            {error}
          </div>
        ) : (
          children
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="sticky bottom-0 z-30 bg-paper-surface/95 backdrop-blur-md border-t border-outline-variant/60">
        <div className="max-w-[1240px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <Link
            to={back.to}
            className="flex items-center gap-2 text-on-surface-variant hover:text-lacquer-red transition-colors font-label-caps text-[11px] uppercase tracking-widest font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span className="hidden sm:inline">{back.label}</span>
          </Link>

          <Countdown seconds={remaining} urgent={urgent} committed={committed} />

          <button
            onClick={() => setAbortOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-lacquer-red/50 text-lacquer-red hover:bg-lacquer-red hover:text-white transition-colors font-label-caps text-[11px] uppercase tracking-widest font-bold cursor-pointer"
          >
            <span className="hidden sm:inline">Skip to Emergency Abort</span>
            <span className="sm:hidden">Abort</span>
            <span className="material-symbols-outlined text-[16px]">emergency</span>
          </button>
        </div>
      </footer>

      {expired && !committed && (
        <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center px-5 pointer-events-none">
          <div className="pointer-events-auto max-w-xl w-full p-4 rounded-xl bg-amber-500/15 border border-amber-600/50 backdrop-blur-md flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] text-amber-800 shrink-0">timer_off</span>
            <p className="font-mono text-xs text-amber-900 leading-relaxed">
              <strong>Auto-hold engaged.</strong> The response window elapsed, so the flight computer
              has fallen back to <strong>HOLD_POSITION</strong> — its most conservative state. You can
              still commit a maneuver from here; it will be logged as a post-timeout intervention.
            </p>
          </div>
        </div>
      )}

      <EmergencyAbortModal open={abortOpen} onClose={() => setAbortOpen(false)} />
    </div>
  );
}

/**
 * The countdown readout.
 *
 * The label says AUTO-HOLD, not AUTO-ABORT, because that is what the backend
 * actually does: ArmstrongProtocol falls back to HOLD_POSITION on timeout and
 * never to an abort.
 */
function Countdown({
  seconds,
  urgent,
  committed,
  compact = false,
}: {
  seconds: number;
  urgent: boolean;
  committed: boolean;
  compact?: boolean;
}) {
  if (committed) {
    return (
      <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-moss-accent">
        <span className="material-symbols-outlined text-[16px]">task_alt</span>
        COMMITTED
      </div>
    );
  }

  const expired = seconds <= 0;
  return (
    <div
      className={`flex items-center gap-2 font-mono font-bold tabular-nums ${
        expired ? "text-amber-800" : urgent ? "text-lacquer-red animate-pulse" : "text-ink-charcoal"
      }`}
      title="Time before the flight computer falls back to HOLD_POSITION"
    >
      <span className="material-symbols-outlined text-[16px]">{expired ? "timer_off" : "timer"}</span>
      {!compact && (
        <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
          Auto-hold in
        </span>
      )}
      <span className={compact ? "text-sm" : "text-base"}>
        {expired ? "AUTO-HOLD" : formatClock(seconds)}
      </span>
    </div>
  );
}
