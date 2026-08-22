import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArmstrongShell } from "@/components/armstrong/ArmstrongShell";
import { useArmstrong } from "@/components/armstrong/ArmstrongContext";
import { TrajectoryFrame } from "@/components/armstrong/TrajectoryFrame";
import { TiltCard } from "@/components/motion/TiltCard";
import { Reveal } from "@/components/motion/Reveal";
import {
  evaluateParameters,
  getParameters,
  type Evaluation,
  type ParametersResponse,
  type ParameterSpec,
} from "@/lib/armstrong";

export const Route = createFileRoute("/armstrong/parameters")({
  component: ParametersStep,
});

function ParametersStep() {
  const {
    session,
    pathwayId,
    pathway,
    values,
    setValues,
    presetId,
    setPresetId,
    evaluation,
    setEvaluation,
  } = useArmstrong();
  const navigate = useNavigate();

  const [data, setData] = useState<ParametersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [technical, setTechnical] = useState(false);


  // No pathway chosen means the operator deep-linked here; send them to step 1.
  useEffect(() => {
    if (session && !pathwayId) navigate({ to: "/armstrong/pathway", replace: true });
  }, [session, pathwayId, navigate]);

  // Load the specs and presets for THIS pathway. Different pathways expose
  // genuinely different knobs, so this refetches whenever the selection changes.
  useEffect(() => {
    if (!session || !pathwayId) return;
    let cancelled = false;
    setLoading(true);
    getParameters(session.session_id, pathwayId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
        // Seed from the recommended preset unless the operator already tuned
        // something on a previous visit to this step.
        if (Object.keys(values).length === 0) {
          const preset =
            res.presets.find((p) => p.id === res.recommended_preset) ?? res.presets[0];
          if (preset) {
            setValues(preset.values);
            setPresetId(preset.id);
            setEvaluation(preset.evaluation);
          }
        }
      })
      .catch((e) => !cancelled && setError(e?.message || "Could not load parameters"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `values` intentionally excluded: this must not refire on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_id, pathwayId]);

  // Debounced re-evaluation. Every readout on this screen — predicted Jensen
  // Gain, delta-V, the trajectory, the collision bound — comes back from this
  // call, so dragging a slider moves real physics.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const runEvaluation = useCallback(
    (next: Record<string, number>) => {
      if (!session || !pathwayId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setEvaluating(true);
      timerRef.current = setTimeout(async () => {
        const token = ++requestRef.current;
        try {
          const res = await evaluateParameters(session.session_id, pathwayId, next);
          // Ignore a slow response that a newer edit has already superseded.
          if (token === requestRef.current) {
            setEvaluation(res.evaluation);
            setError(null);
          }
        } catch (e: any) {
          if (token === requestRef.current) setError(e?.message || "Evaluation failed");
        } finally {
          if (token === requestRef.current) setEvaluating(false);
        }
      }, 220);
    },
    [session, pathwayId, setEvaluation],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const applyPreset = (presetKey: string) => {
    const preset = data?.presets.find((p) => p.id === presetKey);
    if (!preset) return;
    setValues(preset.values);
    setPresetId(preset.id);
    setEvaluation(preset.evaluation);
  };

  const editValue = (key: string, value: number) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setPresetId("custom");
    runEvaluation(next);
  };

  const snap = data?.snapshot ?? session?.snapshot;
  const jgLive = session?.live_jensen_gain_deg ?? snap?.jensen_gain_deg ?? 0;

  return (
    <ArmstrongShell
      step="parameters"
      title="Configure Recovery Parameters"
      back={{ to: "/armstrong/pathway", label: "Back to Pathway Selection" }}
    >
      {!session || !pathway ? null : (
        <>
          {/* Active pathway + live uncertainty */}
          <Reveal from="up">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-lacquer-red/10 border border-lacquer-red/30">
                <span className="w-2 h-2 rounded-full bg-lacquer-red" />
                <span className="font-label-caps text-[10px] uppercase tracking-[0.16em] font-bold text-lacquer-red">
                  Active pathway: {pathway.title}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTechnical((t) => !t)}
                  className="flex items-center rounded-full border border-outline-variant overflow-hidden font-label-caps text-[10px] uppercase tracking-wider font-bold cursor-pointer"
                >
                  <span className={`px-3 py-1.5 transition-colors ${!technical ? "bg-lacquer-red text-white" : "text-on-surface-variant"}`}>
                    Plain Language
                  </span>
                  <span className={`px-3 py-1.5 transition-colors ${technical ? "bg-lacquer-red text-white" : "text-on-surface-variant"}`}>
                    Technical Math
                  </span>
                </button>
                <div className="text-right">
                  <div className="font-label-caps text-[9px] uppercase tracking-wider text-on-surface-variant">
                    Live Jensen Gain
                  </div>
                  <div className="font-mono text-lg font-bold text-lacquer-red leading-none">
                    {jgLive.toFixed(1)}°
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {session.situation_changed && (
            <div className="p-3 rounded-lg bg-amber-500/12 border border-amber-600/40 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-800 shrink-0">
                change_circle
              </span>
              <span className="font-mono text-[11px] text-amber-900 leading-relaxed">
                <strong>Situation changed — re-check.</strong> The Jensen Gain has moved{" "}
                {session.jensen_gain_drift_deg > 0 ? "+" : ""}
                {session.jensen_gain_drift_deg.toFixed(2)}° since this console opened. These
                predictions were computed against the live state, but the pathway ranking on step 1
                may no longer be the best available.
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-xs text-lacquer-red">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 flex justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
            </div>
          ) : (
            <div className="grid lg:grid-cols-12 gap-5">
              {/* ── Left: presets and knobs ───────────────────── */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  {data?.presets.map((preset, i) => {
                    const active = presetId === preset.id;
                    const recommended = data.recommended_preset === preset.id;
                    return (
                      <Reveal key={preset.id} from="up" delay={i * 60}>
                        <TiltCard
                          maxTilt={4}
                          lift={8}
                          selected={active}
                          onClick={() => applyPreset(preset.id)}
                          ariaLabel={`Apply the ${preset.label} preset`}
                          className={`h-full rounded-xl border-2 p-4 bg-paper-surface/94 ${
                            active ? "border-lacquer-red" : "border-outline-variant/70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-headline-sm text-[13px] font-bold text-ink-charcoal leading-snug">
                              {preset.label}
                            </h3>
                            {recommended && (
                              <span className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border bg-moss-accent/10 border-moss-accent/40 text-moss-accent uppercase">
                                Rec
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed text-ink-charcoal/75 mb-3 min-h-[3.5em]">
                            {preset.description}
                          </p>
                          <dl className="grid grid-cols-2 gap-2 pt-2.5 border-t border-outline-variant/50 font-mono text-[11px]">
                            <div>
                              <dt className="text-[9px] uppercase text-on-surface-variant">ΔV</dt>
                              <dd className="font-bold text-ink-charcoal">
                                {preset.evaluation.delta_v_mps.toFixed(3)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[9px] uppercase text-on-surface-variant">Pred JG</dt>
                              <dd className="font-bold text-ink-charcoal">
                                {preset.evaluation.predicted_jensen_gain_deg.toFixed(1)}°
                              </dd>
                            </div>
                          </dl>
                        </TiltCard>
                      </Reveal>
                    );
                  })}
                </div>

                {/* The actual operator controls */}
                <Reveal from="up" delay={140}>
                  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h3 className="font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold text-ink-charcoal">
                        Maneuver parameters
                      </h3>
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                          presetId === "custom"
                            ? "bg-lacquer-red/10 text-lacquer-red"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {presetId === "custom" ? "OPERATOR TUNED" : `PRESET · ${presetId ?? "—"}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mb-5">
                      Every field below is a real command parameter. Changing one recomputes the
                      predicted uncertainty, delta-V and collision bound against the live flight
                      state.
                    </p>

                    <div className="flex flex-col gap-6">
                      {data?.specs.map((spec) => (
                        <ParameterControl
                          key={spec.key}
                          spec={spec}
                          value={values[spec.key] ?? spec.default}
                          onChange={(v) => editValue(spec.key, v)}
                          showDescription={!technical}
                        />
                      ))}
                    </div>
                  </div>
                </Reveal>
              </div>

              {/* ── Right: consequences ───────────────────────── */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <Reveal from="right">
                  <TrajectoryFrame
                    rVec={snap?.r_vec ?? [0, 0, 0]}
                    vVec={snap?.v_vec}
                    trajectory={evaluation?.collision.trajectory_mean}
                    keepoutM={evaluation?.collision.keepout_radius_m ?? 2}
                    label="Trajectory Prediction"
                    caption={
                      presetId === "custom"
                        ? "operator-tuned parameters"
                        : `${data?.presets.find((p) => p.id === presetId)?.label ?? ""}`
                    }
                    height={250}
                  />
                </Reveal>

                <Reveal from="right" delay={80}>
                  <OutcomePanel evaluation={evaluation} evaluating={evaluating} technical={technical} />
                </Reveal>

                <button
                  onClick={() => navigate({ to: "/armstrong/review" })}
                  disabled={!evaluation}
                  className="group w-full inline-flex items-center justify-center gap-2.5 bg-lacquer-red text-white font-label-caps text-xs uppercase tracking-[0.16em] px-7 py-4 rounded-xl hover:bg-primary transition-all shadow-lg active:scale-[0.98] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Confirm Parameters
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </ArmstrongShell>
  );
}

/** One operator-editable parameter: slider plus a typed numeric field. */
function ParameterControl({
  spec,
  value,
  onChange,
  showDescription,
}: {
  spec: ParameterSpec;
  value: number;
  onChange: (v: number) => void;
  showDescription: boolean;
}) {
  const [text, setText] = useState(value.toFixed(spec.decimals));

  useEffect(() => {
    setText(Number(value).toFixed(spec.decimals));
  }, [value, spec.decimals]);

  const commitText = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      onChange(Math.min(spec.max, Math.max(spec.min, parsed)));
    } else {
      setText(Number(value).toFixed(spec.decimals));
    }
  };

  const pct = ((value - spec.min) / Math.max(1e-9, spec.max - spec.min)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label
          htmlFor={`param-${spec.key}`}
          className="font-label-caps text-[11px] uppercase tracking-wider font-bold text-ink-charcoal"
        >
          {spec.label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={`param-${spec.key}-num`}
            type="number"
            value={text}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => e.key === "Enter" && commitText()}
            aria-label={`${spec.label} value in ${spec.unit}`}
            className="w-24 text-right font-mono text-sm font-bold px-2 py-1 rounded border border-outline-variant bg-surface-container text-ink-charcoal focus:outline-none focus:border-lacquer-red"
          />
          <span className="font-mono text-[11px] text-on-surface-variant w-12">{spec.unit}</span>
        </div>
      </div>

      <input
        id={`param-${spec.key}`}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={spec.label}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-lacquer-red"
        style={{
          background: `linear-gradient(to right, #7A221E 0%, #7A221E ${pct}%, #e4e2de ${pct}%, #e4e2de 100%)`,
        }}
      />

      <div className="flex justify-between font-mono text-[10px] text-on-surface-variant mt-1">
        <span>
          {spec.min.toFixed(spec.decimals)} {spec.unit}
        </span>
        <span>
          {spec.max.toFixed(spec.decimals)} {spec.unit}
        </span>
      </div>

      {showDescription && (
        <p className="text-[11px] leading-relaxed text-on-surface-variant mt-1.5">{spec.description}</p>
      )}
    </div>
  );
}

function OutcomePanel({
  evaluation,
  evaluating,
  technical,
}: {
  evaluation: Evaluation | null;
  evaluating: boolean;
  technical: boolean;
}) {
  if (!evaluation) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 font-mono text-xs text-on-surface-variant">
        Awaiting first evaluation…
      </div>
    );
  }

  const bound = evaluation.collision.collision_prob_upper_bound_99;
  const boundOk = bound <= 0.05;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 relative">
      {evaluating && (
        <span className="absolute top-4 right-4 material-symbols-outlined text-[16px] text-lacquer-red animate-spin">
          progress_activity
        </span>
      )}
      <h3 className="font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold text-ink-charcoal mb-4">
        Predicted outcome
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Metric
          label="Predicted Jensen Gain"
          value={`${evaluation.predicted_jensen_gain_deg.toFixed(2)}°`}
          sub={`${evaluation.jensen_gain_delta_deg >= 0 ? "−" : "+"}${Math.abs(evaluation.jensen_gain_delta_deg).toFixed(2)}° vs now`}
          tone="text-ink-charcoal"
        />
        <Metric
          label="Confidence gain"
          value={`${evaluation.confidence_gain_pct > 0 ? "+" : ""}${evaluation.confidence_gain_pct}%`}
          sub="of the recoverable spread"
          tone={evaluation.confidence_gain_pct < 0 ? "text-lacquer-red" : "text-moss-accent"}
        />
        <Metric
          label="ΔV required"
          value={`${evaluation.delta_v_mps.toFixed(4)}`}
          sub="m/s"
          tone="text-ink-charcoal"
        />
        <Metric
          label="Collision bound (99%)"
          value={`${(bound * 100).toFixed(2)}%`}
          sub={boundOk ? "within 5% flight limit" : "EXCEEDS 5% flight limit"}
          tone={boundOk ? "text-moss-accent" : "text-lacquer-red"}
        />
      </div>

      <div className="pt-3 border-t border-outline-variant/50 flex flex-col gap-1 font-mono text-[11px] text-on-surface-variant">
        <div className="flex justify-between">
          <span>Resulting flight mode</span>
          <span className="font-bold text-lacquer-red">
            {evaluation.resulting_action.toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Mission success</span>
          <span className="font-bold text-ink-charcoal">
            {(evaluation.mission_success_prob * 100).toFixed(1)}%
          </span>
        </div>
        {technical && (
          <>
            <div className="flex justify-between">
              <span>Monte-Carlo breaches</span>
              <span className="font-bold text-ink-charcoal">
                {evaluation.collision.breach_count}/{evaluation.collision.n_monte_carlo} over{" "}
                {evaluation.collision.horizon_s}s
              </span>
            </div>
            <div className="flex justify-between">
              <span>5th-pct miss distance</span>
              <span className="font-bold text-ink-charcoal">
                {evaluation.collision.min_distance_p05_m.toFixed(2)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span>σ_r / σ_v dispersion</span>
              <span className="font-bold text-ink-charcoal">
                {evaluation.collision.sigma_r_m.toFixed(3)} m / {evaluation.collision.sigma_v_mps.toExponential(2)} m/s
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div>
      <div className="font-label-caps text-[9px] uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </div>
      <div className={`font-mono text-xl font-bold leading-none ${tone}`}>{value}</div>
      <div className="font-mono text-[10px] text-on-surface-variant mt-1">{sub}</div>
    </div>
  );
}
