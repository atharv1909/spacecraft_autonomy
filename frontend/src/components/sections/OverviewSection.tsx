import { useCallback, useEffect, useState } from "react";
import { useMissionControl } from "@/hooks/useMissionControl";
import { TrajectoryFrame } from "@/components/armstrong/TrajectoryFrame";
import {
  fetchPerceptionHistory,
  fetchRecoveryOptions,
  fetchThresholds,
  ArmstrongError,
  type PerceptionFrame,
  type RecoveryOptionsResponse,
  type Thresholds,
} from "@/lib/armstrong";
import { RangeHistoryChart } from "@/components/charts/TelemetryCharts";

/**
 * Relative state derived from the optical chain.
 *
 * Scope note: this dashboard's only sensor is a camera. Vehicle housekeeping —
 * tank state, thruster duty, component temperatures, link budgets — is not
 * shown, because none of it can be measured from a photograph and a plausible
 * number in a mission-control panel reads exactly like a real one.
 */
export function OverviewSection() {
  const { latest, events } = useMissionControl();
  const [recovery, setRecovery] = useState<RecoveryOptionsResponse | null>(null);
  const [noEvidence, setNoEvidence] = useState<string | null>(null);
  const [frames, setFrames] = useState<PerceptionFrame[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);

  const p = latest.perception;
  const a = latest.action;
  const cons = latest.consensus;

  const load = useCallback(async () => {
    try {
      setRecovery(await fetchRecoveryOptions());
      setNoEvidence(null);
    } catch (e) {
      if (e instanceof ArmstrongError && e.status === 409) {
        setRecovery(null);
        setNoEvidence(e.message);
      }
    }
    try {
      setFrames((await fetchPerceptionHistory(120)).frames);
    } catch {
      /* plotting only */
    }
  }, []);

  useEffect(() => {
    fetchThresholds().then(setThresholds).catch(() => setThresholds(null));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load, p?.timestamp]);

  const hasPose = Boolean(p && Array.isArray(p.t) && p.t.length >= 3);
  const rangeM = hasPose ? Math.hypot(p!.t[0]!, p!.t[1]!, p!.t[2]!) : null;
  const jg = p?.jensen_gain ?? null;

  // Closing rate is a two-frame quantity: finite-difference the last pair of
  // range fixes. With a single frame it is genuinely unknown, and saying so is
  // more useful than printing a number the camera never measured.
  const closingRate = (() => {
    if (frames.length < 2) return null;
    const b = frames[frames.length - 1]!;
    const a2 = frames[frames.length - 2]!;
    const dt = b.timestamp - a2.timestamp;
    if (!Number.isFinite(dt) || Math.abs(dt) < 1e-3) return null;
    return (b.range_m - a2.range_m) / dt;
  })();

  const scrollToUpload = () =>
    document.getElementById("section-perception")?.scrollIntoView({ behavior: "smooth" });

  if (!hasPose) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center flex flex-col items-center gap-4 shadow-sm">
        <span className="material-symbols-outlined text-[40px] text-outline-variant">
          satellite_alt
        </span>
        <p className="font-mono text-xs text-on-surface-variant max-w-md leading-relaxed">
          {noEvidence ??
            "No pose estimate yet. Relative state, corridor geometry and safety bounds are all derived from the camera, so there is nothing to display until a frame has been processed."}
        </p>
        <button
          onClick={scrollToUpload}
          className="bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-widest px-5 py-3 rounded-lg hover:bg-primary transition-colors font-bold cursor-pointer"
        >
          Submit a frame
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gutter">
      {/* ── Derived state ribbon ────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi
          label="Current Action"
          value={cons?.final_action ?? a?.primary_action ?? null}
          detail={cons?.reasoning?.split("|")[0] ?? null}
          tone="moss"
        />
        <Kpi
          label="Range to Target"
          value={rangeM != null ? `${rangeM.toFixed(2)} m` : null}
          detail={
            closingRate != null
              ? `${closingRate < 0 ? "closing" : "opening"} at ${Math.abs(closingRate).toFixed(3)} m/s`
              : "closing rate needs a second frame"
          }
        />
        <Kpi
          label="Jensen Gain"
          value={jg != null ? `${jg.toFixed(2)}°` : null}
          detail={
            thresholds
              ? `trust limit ${thresholds.moderate_thresh_deg.toFixed(1)}° · high-confidence ${thresholds.high_confidence_thresh_deg.toFixed(1)}°`
              : null
          }
          tone={
            thresholds && jg != null
              ? jg < thresholds.high_confidence_thresh_deg
                ? "moss"
                : jg < thresholds.moderate_thresh_deg
                  ? "amber"
                  : "lacquer"
              : undefined
          }
        />
        <Kpi
          label="Collision Bound (99%)"
          value={
            a?.collision_prob_upper_bound_99 != null
              ? `${(a.collision_prob_upper_bound_99 * 100).toFixed(2)}%`
              : null
          }
          detail="Clopper-Pearson exact, over the CWH Monte-Carlo"
          tone={
            a?.collision_prob_upper_bound_99 != null
              ? a.collision_prob_upper_bound_99 <= 0.05
                ? "moss"
                : "lacquer"
              : undefined
          }
        />
      </section>

      {/* ── Geometry + ledger ───────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
        <div className="xl:col-span-8 flex flex-col gap-4">
          <TrajectoryFrame
            rVec={p!.t}
            keepoutM={2}
            label="Relative geometry (CWH frame)"
            caption={rangeM != null ? `range ${rangeM.toFixed(2)} m` : undefined}
            height={320}
          />
          <RangeHistoryChart frames={frames} />
        </div>

        <div className="xl:col-span-4 bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <div className="px-container-padding py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h2 className="font-label-caps text-label-caps text-ink-charcoal uppercase tracking-widest flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[18px] opacity-70">terminal</span>
              Live Decision Ledger
            </h2>
            <span className="font-mono text-xs text-on-surface-variant">{events.length} events</span>
          </div>
          <div className="flex-1 p-3 overflow-y-auto max-h-[460px] custom-scrollbar flex flex-col gap-2 font-mono text-xs">
            {events.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant">
                No decisions recorded yet.
              </div>
            ) : (
              events
                .slice(-18)
                .reverse()
                .map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-surface-container-low border border-outline-variant/40 flex flex-col gap-1"
                  >
                    <div className="flex justify-between text-[10px] text-on-surface-variant font-bold">
                      <span className="text-lacquer-red">{ev.channel}</span>
                      <span>{ev.time}</span>
                    </div>
                    <div className="text-ink-charcoal break-words">{ev.summary}</div>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      {/* ── Approach corridor, computed from the pose ───────────── */}
      {recovery && (
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px] text-lacquer-red">explore</span>
              Approach Corridor Geometry
            </h3>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                recovery.in_approach_cone
                  ? "bg-moss-accent/10 text-moss-accent"
                  : "bg-lacquer-red/10 text-lacquer-red"
              }`}
            >
              {recovery.in_approach_cone ? "INSIDE CORRIDOR" : "OUTSIDE CORRIDOR"}
            </span>
          </div>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 font-mono text-xs">
            <Row label="Flight phase" value={recovery.flight_phase.replace(/_/g, " ")} />
            <Row label="Cone margin" value={`${recovery.cone_margin_deg.toFixed(2)}°`} />
            <Row label="Range" value={`${recovery.range_m.toFixed(2)} m`} />
            <Row
              label="Frames used"
              value={`${recovery.frames_used}${recovery.velocity_observed ? "" : " (velocity not yet observable)"}`}
            />
          </dl>
          {recovery.tripwire_triggered && (
            <div className="mt-3 p-3 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-[11px] text-lacquer-red">
              {recovery.tripwire_reason}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | null;
  detail: string | null;
  tone?: "moss" | "amber" | "lacquer" | undefined;
}) {
  const colour =
    tone === "moss"
      ? "text-moss-accent"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "lacquer"
          ? "text-lacquer-red"
          : "text-ink-charcoal";
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-container-padding flex flex-col justify-between h-[130px] shadow-sm">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
        {label}
      </h3>
      <div className={`font-mono text-[26px] leading-none font-bold truncate ${value ? colour : "text-outline-variant"}`}>
        {value ?? "—"}
      </div>
      <div className="text-[11px] font-mono text-on-surface-variant line-clamp-2">
        {detail ?? ""}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-outline-variant/30 pb-1">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-bold text-ink-charcoal text-right">{value}</dd>
    </div>
  );
}
