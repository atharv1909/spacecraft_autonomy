import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArmstrongShell } from "@/components/armstrong/ArmstrongShell";
import { useArmstrong } from "@/components/armstrong/ArmstrongContext";
import { TiltCard } from "@/components/motion/TiltCard";
import { Reveal } from "@/components/motion/Reveal";
import {
  commit,
  precommit,
  ArmstrongError,
  type CommitResponse,
  type PrecommitResponse,
} from "@/lib/armstrong";

export const Route = createFileRoute("/armstrong/review")({
  component: ReviewStep,
});

const MIN_RATIONALE = 12;

function ReviewStep() {
  const {
    session,
    pathwayId,
    pathway,
    values,
    presetId,
    rationale,
    setRationale,
    operator,
    setOperator,
    markCommitted,
    reset,
  } = useArmstrong();
  const navigate = useNavigate();

  const [review, setReview] = useState<PrecommitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledge, setAcknowledge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<CommitResponse | null>(null);

  useEffect(() => {
    if (session && !pathwayId) navigate({ to: "/armstrong/pathway", replace: true });
  }, [session, pathwayId, navigate]);

  const loadReview = useCallback(async () => {
    if (!session || !pathwayId) return;
    setLoading(true);
    try {
      const res = await precommit(session.session_id, pathwayId, values);
      setReview(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Could not run pre-commit validation");
    } finally {
      setLoading(false);
    }
  }, [session, pathwayId, values]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const rationaleOk = rationale.trim().length >= MIN_RATIONALE;
  const allPassed = review?.validation.all_passed ?? false;
  const canSubmit = Boolean(review) && rationaleOk && (allPassed || acknowledge) && !submitting;

  const submit = async () => {
    if (!session || !pathwayId) return;
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await commit(session.session_id, {
        pathway: pathwayId,
        values,
        preset: presetId,
        level: session.level,
        rationale: rationale.trim(),
        operator,
        acknowledge_failed_checks: acknowledge,
      });
      markCommitted();
      setResult(res);
    } catch (e: any) {
      if (e instanceof ArmstrongError && e.status === 409) {
        setError("A pre-commit gate failed. Review the failures below and acknowledge explicitly to proceed.");
        await loadReview();
      } else {
        setError(e?.message || "The flight computer rejected the command.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <ArmstrongShell
        step="review"
        title="Override Transmitted"
        back={{ to: "/mission", label: "Back to Mission Control" }}
      >
        <Reveal from="scale">
          <div className="rounded-2xl border-2 border-moss-accent/50 bg-paper-surface/94 p-8 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[32px] text-moss-accent">task_alt</span>
              <div>
                <h2 className="font-headline-md text-xl font-bold text-ink-charcoal">
                  {result.pathway_title} committed
                </h2>
                <p className="font-mono text-xs text-on-surface-variant">
                  Flight mode → <strong className="text-lacquer-red">{result.action.toUpperCase()}</strong> ·
                  level {result.level} · operator {operator}
                </p>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs pt-4 border-t border-outline-variant/50">
              <Line label="Predicted Jensen Gain" value={`${result.evaluation.predicted_jensen_gain_deg.toFixed(2)}°`} />
              <Line label="ΔV expended" value={`${result.evaluation.delta_v_mps.toFixed(4)} m/s`} />
              <Line
                label="Collision bound (99%)"
                value={`${(result.evaluation.collision.collision_prob_upper_bound_99 * 100).toFixed(2)}%`}
              />
              <Line
                label="Manoeuvre duration"
                value={`${result.evaluation.command_duration_s.toFixed(1)} s`}
              />
              <Line
                label="Ledger entries"
                value={`${result.audit.entries_verified ?? 0} · chain ${result.audit.valid ? "valid" : "BROKEN"}`}
              />
              <Line label="Session" value={result.session_id} />
            </dl>

            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/50">
              <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1">
                Chained under
              </div>
              <code className="font-mono text-[11px] text-ink-charcoal break-all">{result.entry_hash}</code>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate({ to: "/mission", hash: "section-overrides" })}
                className="inline-flex items-center gap-2 bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-widest px-6 py-3.5 rounded-xl hover:bg-primary transition-colors font-bold cursor-pointer"
              >
                View in Mission Control
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                onClick={async () => {
                  setResult(null);
                  await reset();
                  navigate({ to: "/armstrong/pathway" });
                }}
                className="inline-flex items-center gap-2 border border-outline-variant text-ink-charcoal font-label-caps text-[11px] uppercase tracking-widest px-6 py-3.5 rounded-xl hover:bg-surface-container transition-colors font-bold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                New Override
              </button>
            </div>
          </div>
        </Reveal>
      </ArmstrongShell>
    );
  }

  return (
    <ArmstrongShell
      step="review"
      title={`Final Safety Review — ${session?.session_id ?? ""}`}
      back={{ to: "/armstrong/parameters", label: "Back to Parameters" }}
    >
      {!session || !pathway ? null : (
        <>
          <Reveal from="up">
            <p className="text-sm text-ink-charcoal/80 max-w-3xl -mt-2">
              Review maneuver integrity and provide the rationale that will be appended to the
              SHA-256 audit chain. This action is irreversible once committed to the ledger.
            </p>
          </Reveal>

          {/* Selected path recap */}
          <Reveal from="up" delay={60}>
            <div className="rounded-xl border-l-4 border-lacquer-red bg-surface-container-low px-5 py-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
              <span className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                Selected maneuver path
              </span>
              <span className="font-bold text-ink-charcoal">{pathway.title}</span>
              <span className="text-on-surface-variant">→</span>
              <span className="font-bold text-ink-charcoal">
                {presetId === "custom" ? "operator-tuned" : (presetId ?? "—")}
              </span>
              <span className="text-on-surface-variant">→</span>
              <span className="font-bold text-lacquer-red">
                ΔV {review?.evaluation.delta_v_mps.toFixed(4) ?? "—"} m/s
              </span>
              <span className="text-on-surface-variant">→</span>
              <span className="font-bold text-lacquer-red">
                {review?.evaluation.resulting_action.toUpperCase() ?? "—"}
              </span>
            </div>
          </Reveal>

          {/* Pre-commit gates */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-headline-sm text-base font-bold text-ink-charcoal">
                Pre-Commit Validation
              </h2>
              <button
                onClick={loadReview}
                className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant hover:text-lacquer-red transition-colors cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[14px] ${loading ? "animate-spin" : ""}`}>
                  refresh
                </span>
                Re-run checks
              </button>
            </div>

            {loading && !review ? (
              <div className="py-16 flex justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[26px] animate-spin">progress_activity</span>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {review?.validation.checks.map((check, i) => (
                  <Reveal key={check.id} from="up" delay={i * 60}>
                    <TiltCard
                      maxTilt={3}
                      lift={6}
                      glare={false}
                      className={`h-full rounded-xl border-l-4 border p-5 bg-paper-surface/94 ${
                        check.passed
                          ? "border-l-moss-accent border-outline-variant/70"
                          : "border-l-lacquer-red border-lacquer-red/50 bg-lacquer-red/[0.04]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`material-symbols-outlined text-[22px] shrink-0 ${
                            check.passed ? "text-moss-accent" : "text-lacquer-red"
                          }`}
                        >
                          {check.passed ? "check_box" : "dangerous"}
                        </span>
                        <div className="min-w-0">
                          <h3
                            className={`font-headline-sm text-sm font-bold mb-1 ${
                              check.passed ? "text-ink-charcoal" : "text-lacquer-red"
                            }`}
                          >
                            {check.label}
                            {!check.passed && (
                              <span className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-lacquer-red text-white uppercase align-middle">
                                Failed
                              </span>
                            )}
                          </h3>
                          <p className="text-xs leading-relaxed text-ink-charcoal/80">{check.detail}</p>
                        </div>
                      </div>
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          {/* Failure acknowledgement */}
          {review && !allPassed && (
            <Reveal from="up">
              <div className="rounded-xl border-2 border-lacquer-red bg-lacquer-red/[0.06] p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="material-symbols-outlined text-[22px] text-lacquer-red shrink-0">warning</span>
                  <div>
                    <h3 className="font-headline-sm text-sm font-bold text-lacquer-red mb-1">
                      {review.validation.failed.length} pre-commit gate
                      {review.validation.failed.length === 1 ? "" : "s"} did not pass
                    </h3>
                    <p className="text-xs leading-relaxed text-ink-charcoal/85">
                      Committing anyway is permitted — the Armstrong Protocol never blocks a human —
                      but the failure is recorded in the ledger alongside your rationale and will be
                      visible to the review board.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledge}
                    onChange={(e) => setAcknowledge(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-lacquer-red cursor-pointer"
                  />
                  <span className="text-xs font-mono text-ink-charcoal">
                    I accept responsibility for committing over{" "}
                    {review.validation.failed.map((f) => f.replace(/_/g, " ")).join(", ")}.
                  </span>
                </label>
              </div>
            </Reveal>
          )}

          {/* Rationale */}
          <Reveal from="up" delay={80}>
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <label
                  htmlFor="rationale"
                  className="font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold text-ink-charcoal"
                >
                  Engineering rationale <span className="text-lacquer-red">(required)</span>
                </label>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="operator"
                    className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold"
                  >
                    Operator
                  </label>
                  <input
                    id="operator"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-40 font-mono text-xs px-2.5 py-1.5 rounded border border-outline-variant bg-surface-container text-ink-charcoal focus:outline-none focus:border-lacquer-red"
                  />
                </div>
              </div>

              <textarea
                id="rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                onBlur={() => setTouched(true)}
                rows={4}
                placeholder="Describe the engineering intent for this manual intervention. This text is appended verbatim to the telemetry audit log — it is the record of why, and nothing else fills that field."
                className={`w-full text-sm font-mono p-3.5 rounded-lg bg-surface-container border text-ink-charcoal focus:outline-none resize-y transition-colors ${
                  touched && !rationaleOk
                    ? "border-lacquer-red focus:border-lacquer-red"
                    : "border-outline-variant focus:border-lacquer-red"
                }`}
              />
              <div className="flex justify-between items-center mt-1.5">
                <p
                  className={`font-mono text-[11px] ${
                    touched && !rationaleOk ? "text-lacquer-red font-bold" : "text-on-surface-variant"
                  }`}
                >
                  {touched && !rationaleOk
                    ? `A written rationale of at least ${MIN_RATIONALE} characters is required before transmit.`
                    : `${rationale.trim().length} / ${MIN_RATIONALE} characters minimum`}
                </p>
                {review && (
                  <p className="font-mono text-[11px] text-on-surface-variant">
                    Chain: {review.validation.audit.entries_verified ?? 0} entries ·{" "}
                    {review.validation.audit.valid ? "valid" : "BROKEN"}
                  </p>
                )}
              </div>
            </div>
          </Reveal>

          {error && (
            <div className="p-4 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-xs text-lacquer-red">
              {error}
            </div>
          )}

          {/* Commit */}
          <div className="flex flex-wrap justify-end gap-3 pb-2">
            <button
              onClick={async () => {
                await reset();
                navigate({ to: "/armstrong/pathway" });
              }}
              className="inline-flex items-center gap-2 border border-outline-variant text-ink-charcoal font-label-caps text-[11px] uppercase tracking-widest px-6 py-3.5 rounded-xl hover:bg-surface-container transition-colors font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Start Over
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2.5 bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-widest px-8 py-3.5 rounded-xl hover:bg-primary transition-colors font-bold shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">settings_input_antenna</span>
              {submitting ? "Transmitting…" : "Confirm & Transmit"}
            </button>
          </div>
        </>
      )}
    </ArmstrongShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-outline-variant/30 py-1">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-bold text-ink-charcoal text-right break-all">{value}</dd>
    </div>
  );
}
