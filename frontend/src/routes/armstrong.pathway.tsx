import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArmstrongShell } from "@/components/armstrong/ArmstrongShell";
import { useArmstrong } from "@/components/armstrong/ArmstrongContext";
import { TrajectoryFrame } from "@/components/armstrong/TrajectoryFrame";
import { TiltCard } from "@/components/motion/TiltCard";
import { Reveal } from "@/components/motion/Reveal";
import { badgeClasses, deriveBadge } from "@/lib/armstrong";
import { useMissionControl } from "@/hooks/useMissionControl";

export const Route = createFileRoute("/armstrong/pathway")({
  component: PathwayStep,
});

function PathwayStep() {
  const { session, pathwayId, selectPathway } = useArmstrong();
  const [technical, setTechnical] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const navigate = useNavigate();

  const pathways = session?.pathways ?? [];

  // Rank once, then reuse: the badge on every card is a pure function of the
  // computed confidence gains, so it cannot fall out of step with the numbers
  // printed underneath it.
  const badges = useMemo(() => {
    const map = new Map<string, ReturnType<typeof deriveBadge>>();
    for (const p of pathways) map.set(p.id, deriveBadge(p, pathways));
    return map;
  }, [pathways]);

  // Pre-select the recommended pathway so "Continue" is never a dead button.
  useEffect(() => {
    if (pathwayId || pathways.length === 0) return;
    const recommended = pathways.find((p) => badges.get(p.id) === "RECOMMENDED") ?? pathways[0];
    if (recommended) selectPathway(recommended.id);
  }, [pathwayId, pathways, badges, selectPathway]);

  const snap = session?.snapshot;
  const thresholds = session?.thresholds;
  const jg = session?.live_jensen_gain_deg ?? snap?.jensen_gain_deg ?? 0;

  const confidence = useMemo(() => {
    if (!thresholds) return { label: "UNCALIBRATED", tone: "text-on-surface-variant" };
    if (jg < thresholds.high_confidence_thresh_deg)
      return { label: "HIGH CONFIDENCE", tone: "text-moss-accent" };
    if (jg < thresholds.moderate_thresh_deg)
      return { label: "MODERATE CONFIDENCE", tone: "text-amber-700" };
    return { label: "CRITICAL UNCERTAINTY", tone: "text-lacquer-red" };
  }, [jg, thresholds]);

  const ringFraction = thresholds
    ? Math.min(1, Math.max(0, jg / thresholds.moderate_thresh_deg))
    : 0;

  return (
    <ArmstrongShell
      step="pathway"
      title="Select a Recovery Pathway"
      back={{ to: "/mission", label: "Back to Mission Control" }}
    >
      {!session ? null : (
        <>
          {/* ── Escalation summary ─────────────────────────────── */}
          <Reveal from="up">
            <div className="rounded-xl border border-lacquer-red/30 bg-paper-surface/92 backdrop-blur-sm p-5 flex flex-col lg:flex-row gap-6 items-start">
              {/* Confidence ring */}
              <div className="relative w-[92px] h-[92px] shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e4e2de" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke={ringFraction >= 1 ? "#7A221E" : ringFraction > 0.6 ? "#b45309" : "#5C6300"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(ringFraction * 100).toFixed(2)}, 100`}
                    style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.16,1,0.3,1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-base font-bold text-ink-charcoal leading-none">
                    {jg.toFixed(1)}°
                  </span>
                  <span className="font-label-caps text-[8px] uppercase tracking-wider text-on-surface-variant mt-0.5">
                    Jensen Gain
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className={`font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold ${confidence.tone}`}>
                    {confidence.label}
                  </span>
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    Human confirmation required · {snap?.flight_phase.replace(/_/g, " ")}
                  </span>
                  <button
                    onClick={() => setTechnical((t) => !t)}
                    className="ml-auto flex items-center rounded-full border border-outline-variant overflow-hidden font-label-caps text-[10px] uppercase tracking-wider font-bold cursor-pointer"
                    aria-label="Toggle plain language and technical readout"
                  >
                    <span className={`px-3 py-1.5 transition-colors ${!technical ? "bg-lacquer-red text-white" : "text-on-surface-variant"}`}>
                      Plain Language
                    </span>
                    <span className={`px-3 py-1.5 transition-colors ${technical ? "bg-lacquer-red text-white" : "text-on-surface-variant"}`}>
                      Technical Math
                    </span>
                  </button>
                </div>

                {technical ? (
                  <div className="font-mono text-xs text-ink-charcoal/85 leading-relaxed">
                    <div>
                      G_J = {jg.toFixed(2)}° · high-confidence threshold{" "}
                      {thresholds ? `${thresholds.high_confidence_thresh_deg.toFixed(1)}°` : "—"} ·
                      moderate threshold{" "}
                      {thresholds ? `${thresholds.moderate_thresh_deg.toFixed(1)}°` : "—"}
                    </div>
                    <div>
                      σ_R = {snap?.sigma_R_deg.toFixed(2)}° · σ_t = {snap?.sigma_t_m.toFixed(3)} m ·
                      range {snap?.range_m.toFixed(2)} m · off-axis {snap?.off_axis_deg.toFixed(2)}° ·
                      cone margin {snap?.cone_margin_deg.toFixed(2)}°
                    </div>
                    <div className="mt-1.5 text-on-surface-variant">{session.escalation_reason}</div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-ink-charcoal/85">
                    {session.escalation_reason}
                  </p>
                )}

                {session.situation_changed && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/12 border border-amber-600/40 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-800 shrink-0">
                      change_circle
                    </span>
                    <span className="font-mono text-[11px] text-amber-900 leading-relaxed">
                      Situation changed — the Jensen Gain has moved{" "}
                      {session.jensen_gain_drift_deg > 0 ? "+" : ""}
                      {session.jensen_gain_drift_deg.toFixed(2)}° since this console was opened
                      ({session.opened_jensen_gain_deg.toFixed(2)}° → {jg.toFixed(2)}°). Re-check the
                      pathway ranking before committing.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          {/* ── Live frame ─────────────────────────────────────── */}
          <Reveal from="up" delay={80}>
            <TrajectoryFrame
              rVec={snap?.r_vec ?? [0, 0, 0]}
              vVec={snap?.v_vec}
              keepoutM={2}
              caption={`Range ${snap?.range_m.toFixed(2)} m · closing ${snap?.range_rate_mps.toFixed(3)} m/s`}
              height={280}
            />
          </Reveal>

          {/* ── Pathway cards ──────────────────────────────────── */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold text-on-surface-variant">
                Mathematically certified recovery pathways
              </h2>
              <span className="font-mono text-[11px] text-on-surface-variant">
                {pathways.length} computed by the flight director
              </span>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pathways.map((p, i) => {
                const badge = badges.get(p.id) ?? "ALTERNATIVE";
                const selected = pathwayId === p.id;
                return (
                  <Reveal key={p.id} from="up" delay={i * 55}>
                    <TiltCard
                      maxTilt={5}
                      lift={10}
                      selected={selected}
                      onClick={() => selectPathway(p.id)}
                      ariaLabel={`Select ${p.title}`}
                      className={`h-full rounded-xl border-2 p-5 flex flex-col bg-paper-surface/94 backdrop-blur-sm transition-colors ${
                        selected ? "border-lacquer-red" : "border-outline-variant/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              selected ? "text-lacquer-red" : "text-on-surface-variant"
                            }`}
                          >
                            {selected ? "radio_button_checked" : p.icon}
                          </span>
                          <h3 className="font-headline-sm text-sm font-bold text-ink-charcoal leading-snug">
                            {p.title}
                          </h3>
                        </div>
                        <span
                          className={`shrink-0 text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeClasses(badge)}`}
                        >
                          {badge}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-ink-charcoal/80 flex-1 mb-4">
                        {technical ? p.description : p.plain_explanation}
                      </p>

                      {technical && (
                        <code className="block text-[10px] font-mono bg-surface-container-low border border-outline-variant/50 rounded px-2 py-1.5 mb-3 text-on-surface-variant break-words">
                          {p.mathematical_basis}
                        </code>
                      )}

                      <dl className="grid grid-cols-3 gap-2 pt-3 border-t border-outline-variant/50 font-mono text-[11px]">
                        <div>
                          <dt className="text-[9px] uppercase text-on-surface-variant">ΔV</dt>
                          <dd className="font-bold text-ink-charcoal">{p.delta_v_mps.toFixed(3)}</dd>
                        </div>
                        <div>
                          <dt className="text-[9px] uppercase text-on-surface-variant">Pred JG</dt>
                          <dd className="font-bold text-ink-charcoal">{p.predicted_jg_deg.toFixed(1)}°</dd>
                        </div>
                        <div>
                          <dt className="text-[9px] uppercase text-on-surface-variant">Gain</dt>
                          <dd
                            className={`font-bold ${
                              p.confidence_gain_pct < 0 ? "text-lacquer-red" : "text-moss-accent"
                            }`}
                          >
                            {p.confidence_gain_pct > 0 ? "+" : ""}
                            {p.confidence_gain_pct}%
                          </dd>
                        </div>
                      </dl>
                    </TiltCard>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* ── Evidence ───────────────────────────────────────── */}
          <EvidencePanel open={evidenceOpen} onToggle={() => setEvidenceOpen((o) => !o)} />

          <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="font-mono text-[11px] text-on-surface-variant">
              SHA-256 chain{" "}
              <span className={session.audit.valid ? "text-moss-accent font-bold" : "text-lacquer-red font-bold"}>
                {session.audit.valid ? "valid" : "BROKEN"}
              </span>{" "}
              · {session.audit.entries_verified ?? 0} entries · session {session.session_id}
            </div>
            <button
              onClick={() => navigate({ to: "/armstrong/parameters" })}
              disabled={!pathwayId}
              className="group inline-flex items-center gap-2.5 bg-lacquer-red text-white font-label-caps text-xs uppercase tracking-[0.16em] px-7 py-3.5 rounded-xl hover:bg-primary transition-all shadow-lg active:scale-[0.98] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Continue to Parameters
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </button>
          </div>
        </>
      )}
    </ArmstrongShell>
  );
}

/**
 * The cognition agent already computes a narrative, a per-component influence
 * breakdown and a similarity heatmap server-side. This panel just surfaces
 * what is on the bus rather than restating it in the UI.
 */
function EvidencePanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { latest } = useMissionControl();
  const cog = latest.cognition as any;
  const payload = cog?.payload ?? cog ?? {};
  const explanation = payload?.explanation;
  const narrative =
    (typeof explanation === "object" ? explanation?.narrative : undefined) ??
    (typeof explanation === "string" ? explanation : undefined) ??
    payload?.root_cause_narrative;
  const breakdown =
    (typeof explanation === "object" ? explanation?.component_breakdown : undefined) ??
    cog?.component_breakdown ??
    cog?.component_influence;
  const heatmap = typeof explanation === "object" ? explanation?.similarity_heatmap : undefined;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold text-ink-charcoal">
          <span className="material-symbols-outlined text-[18px] text-lacquer-red">
            {open ? "expand_more" : "chevron_right"}
          </span>
          Show Evidence &amp; Rationale
        </span>
        <span className="font-mono text-[11px] text-on-surface-variant">
          Cognition agent · novelty {cog?.novelty_score != null ? Number(cog.novelty_score).toFixed(2) : "—"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-outline-variant/50 flex flex-col gap-4">
          {narrative ? (
            <p className="text-sm leading-relaxed text-ink-charcoal/85">{narrative}</p>
          ) : (
            <p className="font-mono text-xs text-on-surface-variant">
              The cognition agent has not published an explanation for this situation yet.
            </p>
          )}

          {breakdown && Object.keys(breakdown).length > 0 && (
            <div>
              <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-2">
                Component influence on the decision
              </div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(breakdown as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="font-mono text-[11px] w-32 shrink-0 text-on-surface-variant capitalize">
                      {k.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 h-2 rounded bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full bg-lacquer-red rounded transition-all duration-700"
                        style={{ width: `${Math.min(100, Number(v))}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] font-bold w-10 text-right">
                      {Number(v).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(heatmap) && heatmap.length > 0 && (
            <div>
              <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-2">
                Nearest cases in associative memory
              </div>
              <div className="flex flex-col gap-1">
                {heatmap.slice(0, 5).map((c: any) => (
                  <div
                    key={c.case_id}
                    className="flex items-center justify-between gap-3 font-mono text-[11px] px-2.5 py-1.5 rounded bg-surface-container-low border border-outline-variant/40"
                  >
                    <span className="text-on-surface-variant">case #{c.case_id}</span>
                    <span className="text-ink-charcoal">{c.action}</span>
                    <span className="font-bold text-moss-accent">{c.similarity_pct}% match</span>
                    <span className="text-on-surface-variant">{c.outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
