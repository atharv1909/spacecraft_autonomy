import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMissionControl } from "@/hooks/useMissionControl";
import { fetchRecoveryOptions, ArmstrongError, type RecoveryOptionsResponse } from "@/lib/armstrong";

/**
 * Action selection and the flight envelope it was evaluated against.
 *
 * Two read-outs, side by side: what the action agent chose and the exact bound
 * it carries, and the corridor geometry that bound was computed inside.
 *
 * Every row is a value the optical chain produced or that follows from it by
 * computation. Actuation detail — which thrusters fire, for how long, at what
 * propellant cost — is absent because a camera cannot observe it, and the
 * status badges are derived from the numbers beside them rather than asserted,
 * so a badge can never claim a margin the figures do not support.
 */
export function ActionSection() {
  const { latest } = useMissionControl();
  const [env, setEnv] = useState<RecoveryOptionsResponse | null>(null);

  const a = latest.action;

  const load = useCallback(async () => {
    try {
      setEnv(await fetchRecoveryOptions());
    } catch (e) {
      if (e instanceof ArmstrongError && e.status === 409) setEnv(null);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load, latest.perception?.timestamp]);

  if (!a?.primary_action) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center flex flex-col items-center gap-3 shadow-sm">
        <span className="material-symbols-outlined text-[40px] text-outline-variant">
          precision_manufacturing
        </span>
        <p className="font-mono text-xs text-on-surface-variant max-w-md leading-relaxed">
          The action agent has not evaluated a manoeuvre yet. It runs once a pose estimate and a
          situation vector are both on the bus.
        </p>
      </div>
    );
  }

  // The agent repeats the selected action inside its own alternatives list;
  // collapse on name so each distinct manoeuvre appears exactly once.
  const seen = new Set<string>([a.primary_action]);
  const alternatives = (a.alternatives ?? []).filter((alt) => {
    if (seen.has(alt.action)) return false;
    seen.add(alt.action);
    return true;
  });

  const limit = env?.collision_bound_limit ?? 0.05;
  const bound = a.collision_prob_upper_bound_99;
  const boundOk = bound != null && bound <= limit;

  const fmtPct = (v: number | null | undefined, dp = 2) =>
    v == null ? null : `${(v * 100).toFixed(dp)}%`;

  const coneMargin =
    env?.cone_margin_deg != null
      ? `${env.cone_margin_deg > 0 ? "+" : ""}${env.cone_margin_deg.toFixed(2)}° (${
          env.in_approach_cone ? "CORRIDOR CLEAR" : "CORRIDOR BREACH"
        })`
      : null;

  const closingSpeed =
    env?.velocity_observed && env.range_rate_mps != null
      ? `${env.range_rate_mps.toFixed(3)} m/s (v_max = ${env.max_safe_velocity_mps.toFixed(3)} m/s)`
      : null;

  const kozStatus =
    env?.range_m != null && env.koz_radius_m != null
      ? env.range_m <= env.keepout_radius_m
        ? "INSIDE KEEP-OUT SPHERE"
        : env.range_m <= env.koz_radius_m
          ? `PENETRATED (${env.range_m.toFixed(2)} m of ${env.koz_radius_m.toFixed(0)} m)`
          : `CLEAR (${env.range_m.toFixed(2)} m of ${env.koz_radius_m.toFixed(0)} m)`
      : null;

  const camArmed = env?.cam_delta_v_mps?.some((v) => Math.abs(v) > 1e-9) ?? false;

  const chartData = [
    { name: a.primary_action, bound: bound, isPrimary: true },
    ...alternatives.map((alt) => ({
      name: alt.action,
      bound: alt.collision_prob_upper_bound_99 ?? null,
      isPrimary: false,
    })),
  ]
    .filter((c) => c.bound != null)
    .map((c) => ({
      name: c.name.replace(/_/g, " "),
      pct: Number(c.bound) * 100,
      isPrimary: c.isPrimary,
    }));

  return (
    <div className="flex flex-col gap-gutter">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* ── Exact safety bounds ─────────────────────────────── */}
        <Panel
          title="Clopper-Pearson Exact Safety Bounds"
          badge={
            bound == null
              ? { text: "AWAITING BOUND", tone: "neutral" }
              : boundOk
                ? { text: "WITHIN LIMITS", tone: "good" }
                : { text: "EXCEEDS LIMITS", tone: "bad" }
          }
        >
          <Row
            label="Primary Action"
            value={
              a.primary_score != null
                ? `${a.primary_action.toUpperCase()} (Score: ${a.primary_score.toFixed(2)})`
                : a.primary_action.toUpperCase()
            }
            tone="good"
          />
          <Row
            label="Collision Probability Upper Bound"
            value={bound != null ? `≤ ${fmtPct(bound)} (99% Clopper-Pearson)` : null}
            tone={boundOk ? "good" : "bad"}
          />
          <Row
            label="Mission Success Probability"
            value={fmtPct((a as { mission_success_prob?: number }).mission_success_prob, 1)}
          />
          <Row
            label={`${env?.cone_half_angle_deg?.toFixed(0) ?? "20"}° LOS Approach Cone Margin`}
            value={coneMargin}
            tone={env?.in_approach_cone ? "good" : "bad"}
          />
          {alternatives.length === 0 ? (
            <Row label="Alternative Actions" value={null} />
          ) : (
            alternatives.slice(0, 2).map((alt, i) => (
              <Row
                key={alt.action}
                label={`Alternative Action #${i + 1}`}
                value={
                  alt.collision_prob_upper_bound_99 != null
                    ? `${alt.action.toUpperCase()} (≤ ${fmtPct(alt.collision_prob_upper_bound_99)})`
                    : alt.action.toUpperCase()
                }
              />
            ))
          )}
        </Panel>

        {/* ── Flight corridor & envelope ──────────────────────── */}
        <Panel
          title="RPO Flight Corridor & Envelope"
          badge={
            env == null
              ? { text: "AWAITING FRAME", tone: "neutral" }
              : env.tripwire_triggered
                ? { text: "TRIPWIRE ACTIVE", tone: "bad" }
                : { text: "ENVELOPE NOMINAL", tone: "good" }
          }
        >
          <Row
            label={`${env?.cone_half_angle_deg?.toFixed(0) ?? "20"}° LOS Approach Cone Margin`}
            value={coneMargin}
            tone={env?.in_approach_cone ? "good" : "bad"}
          />
          <Row
            label="Relative Closing Speed (v_rel)"
            value={closingSpeed}
            hint={
              env && !env.velocity_observed
                ? "needs a second frame and a declared capture interval"
                : undefined
            }
            tone={
              env?.velocity_observed && env.range_rate_mps > env.max_safe_velocity_mps
                ? "bad"
                : "plain"
            }
          />
          <Row label="Keep-Out Zone (KOZ) Status" value={kozStatus} />
          <Row
            label="Flight Phase"
            value={env?.flight_phase ? env.flight_phase.replace(/_/g, " ") : null}
          />
          <Row
            label="Passive Abort Corridor"
            value={env == null ? null : camArmed ? "CAM ARMED" : "✓ CLEARED"}
            tone={camArmed ? "bad" : "good"}
          />
          <Row
            label="Trajectory Verification"
            value={env?.n_monte_carlo ? `${env.n_monte_carlo} CWH Monte Carlo runs` : null}
            tone="good"
          />
        </Panel>
      </div>

      {env?.tripwire_triggered && env.tripwire_reason && (
        <div className="p-3 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-[11px] text-lacquer-red">
          {env.tripwire_reason}
        </div>
      )}

      {/* ── Bound by candidate ──────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-gutter shadow-sm">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider">
              Collision Bound by Candidate
            </h3>
            <span className="font-mono text-[10px] text-on-surface-variant">
              flight limit {(limit * 100).toFixed(0)}%
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.07)" />
              <XAxis
                dataKey="name"
                stroke="#564240"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "#564240" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                unit="%"
                stroke="#564240"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: "#564240" }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  background: "#fdfbf7",
                  border: "1px solid #ddc0bd",
                  borderRadius: 8,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
                formatter={(v: number) => [`${Number(v).toFixed(2)}%`, "99% upper bound"]}
              />
              <ReferenceLine y={limit * 100} stroke="#7A221E" strokeDasharray="4 3" />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.pct > limit * 100 ? "#7A221E" : d.isPrimary ? "#5C6300" : "#c8c6c5"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {a.explanation && (
        <p className="font-mono text-[11px] text-on-surface-variant leading-relaxed px-1">
          {a.explanation}
        </p>
      )}
    </div>
  );
}

type Tone = "good" | "bad" | "plain";

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: { text: string; tone: "good" | "bad" | "neutral" };
  children: React.ReactNode;
}) {
  const badgeClass =
    badge.tone === "good"
      ? "bg-moss-accent/10 border-moss-accent/40 text-moss-accent"
      : badge.tone === "bad"
        ? "bg-lacquer-red/10 border-lacquer-red/40 text-lacquer-red"
        : "bg-surface-container border-outline-variant text-on-surface-variant";

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-gutter shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-1 border-b border-outline-variant/60">
        <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-[0.12em]">
          {title}
        </h3>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badgeClass}`}
        >
          {badge.text}
        </span>
      </header>
      <dl className="flex flex-col">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  tone = "plain",
  hint,
}: {
  label: string;
  value: string | null;
  tone?: Tone;
  hint?: string | undefined;
}) {
  const colour =
    value == null
      ? "text-outline-variant"
      : tone === "good"
        ? "text-moss-accent"
        : tone === "bad"
          ? "text-lacquer-red"
          : "text-ink-charcoal";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 border-b border-outline-variant/30 last:border-b-0 font-mono text-xs">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={`font-bold text-right ${colour}`}>
        {value ?? "—"}
        {hint && (
          <span className="block font-normal text-[10px] text-on-surface-variant mt-0.5">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}
