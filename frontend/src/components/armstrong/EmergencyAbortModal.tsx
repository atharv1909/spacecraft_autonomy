import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { emergencyAbort, type CommitResponse } from "@/lib/armstrong";
import { useArmstrong } from "./ArmstrongContext";

/**
 * Level 4 emergency abort.
 *
 * Deliberately not a wizard step: an abort is a single irreversible act, so it
 * gets one modal with an explicit typed confirmation and a mandatory rationale.
 * Every "Skip to Emergency Abort" affordance in the console opens this, so
 * there is exactly one abort path in the product.
 */
export function EmergencyAbortModal({
  open,
  onClose,
  onCommitted,
}: {
  open: boolean;
  onClose: () => void;
  onCommitted?: (result: CommitResponse) => void;
}) {
  const { session, operator, markCommitted } = useArmstrong();
  const navigate = useNavigate();
  const [rationale, setRationale] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setRationale("");
      setConfirmText("");
      setError(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rationaleOk = rationale.trim().length >= 12;
  const confirmOk = confirmText.trim().toUpperCase() === "CONFIRM";
  const canSubmit = rationaleOk && confirmOk && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await emergencyAbort({
        rationale: rationale.trim(),
        operator,
        session_id: session?.session_id ?? null,
      });
      markCommitted();
      onCommitted?.(result);
      onClose();
      navigate({ to: "/mission" });
    } catch (e: any) {
      setError(e?.message || "The abort command was rejected by the flight computer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-charcoal/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abort-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg bg-paper-surface rounded-2xl border-2 border-lacquer-red shadow-2xl overflow-hidden outline-none"
      >
        <header className="px-6 py-4 bg-lacquer-red text-white flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px]">emergency</span>
          <div>
            <h2 id="abort-title" className="font-headline-sm text-base font-bold uppercase tracking-wide">
              Level 4 — Emergency Abort
            </h2>
            <p className="font-mono text-[11px] opacity-90">
              Retreat to standoff. This action is irreversible once transmitted.
            </p>
          </div>
        </header>

        <div className="p-6 flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-ink-charcoal/85">
            The vehicle will null its closing rate and translate to an increased standoff range. The
            approach must be re-planned from the ground before another attempt.
          </p>

          <div>
            <label
              htmlFor="abort-rationale"
              className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold block mb-2"
            >
              Engineering rationale <span className="text-lacquer-red">(required)</span>
            </label>
            <textarea
              id="abort-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Why is the approach being abandoned? This text is appended verbatim to the SHA-256 audit chain."
              className="w-full text-sm font-mono p-3 rounded-lg bg-surface-container border border-outline-variant text-ink-charcoal focus:outline-none focus:border-lacquer-red resize-none"
            />
            <p
              className={`font-mono text-[11px] mt-1 ${
                rationaleOk ? "text-on-surface-variant" : "text-lacquer-red"
              }`}
            >
              {rationale.trim().length}/12 characters minimum
            </p>
          </div>

          <div>
            <label
              htmlFor="abort-confirm"
              className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold block mb-2"
            >
              Type <span className="text-lacquer-red font-mono">CONFIRM</span> to arm the command
            </label>
            <input
              id="abort-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full text-sm font-mono p-3 rounded-lg bg-surface-container border border-outline-variant text-ink-charcoal focus:outline-none focus:border-lacquer-red tracking-[0.2em]"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-xs text-lacquer-red">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 bg-surface-container border-t border-outline-variant flex justify-between gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg border border-outline-variant font-label-caps text-[11px] uppercase tracking-wider font-bold text-ink-charcoal hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-6 py-2.5 rounded-lg bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-wider font-bold hover:bg-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">emergency</span>
            {submitting ? "Transmitting…" : "Transmit Abort"}
          </button>
        </footer>
      </div>
    </div>
  );
}
