import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Charts for the optical chain.
 *
 * Every series here is plotted from values the camera actually produced or
 * that follow from them by computation. Nothing is padded with sample data:
 * when there are no frames yet the chart says so rather than drawing a curve.
 */

const INK = "#1a1a1a";
const LACQUER = "#7A221E";
const MOSS = "#5C6300";
const GRID = "rgba(0,0,0,0.07)";
const AXIS = "#564240";

const axisProps = {
  stroke: AXIS,
  tick: { fontSize: 10, fontFamily: "JetBrains Mono, monospace", fill: AXIS },
  tickLine: false,
} as const;

function ChartFrame({
  title,
  caption,
  children,
  empty,
  emptyHint,
  height = 200,
}: {
  title: string;
  caption?: string | undefined;
  children: React.ReactElement;
  empty: boolean;
  emptyHint: string;
  height?: number | undefined;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex flex-col shadow-sm">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-label-caps text-[10px] uppercase tracking-[0.14em] font-bold text-on-surface-variant">
          {title}
        </h3>
        {caption && <span className="font-mono text-[10px] text-on-surface-variant">{caption}</span>}
      </div>
      {empty ? (
        <div
          className="flex items-center justify-center text-center px-4"
          style={{ height }}
        >
          <p className="font-mono text-[11px] text-on-surface-variant max-w-xs leading-relaxed">
            {emptyHint}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "#fdfbf7",
    border: "1px solid #ddc0bd",
    borderRadius: 8,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 11,
  },
  labelStyle: { color: AXIS, fontSize: 10 },
} as const;

export interface PerceptionFrame {
  timestamp: number;
  jensen_gain: number;
  sigma_R_deg: number;
  sigma_t_m: number;
  ood_distance: number;
  physics_residual_m: number;
  calibrated_error_bound_deg: number;
  range_m: number;
  is_trustworthy: boolean;
  is_in_distribution: boolean;
  physics_consistent: boolean;
  source: string;
}

/** Seconds elapsed since the first frame — a real, readable time axis. */
function withElapsed(frames: PerceptionFrame[]) {
  if (frames.length === 0) return [];
  const t0 = frames[0]!.timestamp;
  return frames.map((f) => ({ ...f, t: Number((f.timestamp - t0).toFixed(1)) }));
}

/** Jensen Gain over the processed frames, against its own trust thresholds. */
export function JensenGainHistoryChart({
  frames,
  highThresh,
  moderateThresh,
}: {
  frames: PerceptionFrame[];
  highThresh: number | null;
  moderateThresh: number | null;
}) {
  const data = withElapsed(frames);
  return (
    <ChartFrame
      title="Jensen Gain across processed frames"
      caption={`${frames.length} frame${frames.length === 1 ? "" : "s"}`}
      empty={data.length < 2}
      emptyHint="Two or more frames are needed to plot how the pose spread evolves. Submit frames above."
    >
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="jgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LACQUER} stopOpacity={0.28} />
            <stop offset="100%" stopColor={LACQUER} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="t" unit="s" {...axisProps} />
        <YAxis unit="°" {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)}°`, "Jensen Gain"]} />
        {highThresh != null && (
          <ReferenceLine
            y={highThresh}
            stroke={MOSS}
            strokeDasharray="4 3"
            label={{ value: `high ${highThresh}°`, position: "insideTopRight", fontSize: 9, fill: MOSS }}
          />
        )}
        {moderateThresh != null && (
          <ReferenceLine
            y={moderateThresh}
            stroke={LACQUER}
            strokeDasharray="4 3"
            label={{ value: `trust limit ${moderateThresh}°`, position: "insideTopRight", fontSize: 9, fill: LACQUER }}
          />
        )}
        <Area type="monotone" dataKey="jensen_gain" stroke={LACQUER} strokeWidth={2} fill="url(#jgFill)" />
      </AreaChart>
    </ChartFrame>
  );
}

/** Range and translational sigma — both straight out of the pose estimate. */
export function RangeHistoryChart({ frames }: { frames: PerceptionFrame[] }) {
  const data = withElapsed(frames);
  return (
    <ChartFrame
      title="Range to target and translational σ"
      caption="metres"
      empty={data.length < 2}
      emptyHint="Range history appears once a second frame has been processed."
    >
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="t" unit="s" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v: any, n: any) => [Number(v).toFixed(3), n === "range_m" ? "range (m)" : "σ_t (m)"]} />
        <Line type="monotone" dataKey="range_m" stroke={INK} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="sigma_t_m" stroke={MOSS} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ChartFrame>
  );
}

/** Mahalanobis OOD distance against the detector's fitted 99th percentile. */
export function OodHistoryChart({
  frames,
  threshold,
}: {
  frames: PerceptionFrame[];
  threshold: number | null;
}) {
  const data = withElapsed(frames);
  return (
    <ChartFrame
      title="Mahalanobis OOD distance"
      caption={threshold != null ? `99th pct ${threshold.toFixed(1)}` : undefined}
      empty={data.length < 2}
      emptyHint="The out-of-distribution trace needs at least two processed frames."
    >
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="oodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MOSS} stopOpacity={0.3} />
            <stop offset="100%" stopColor={MOSS} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="t" unit="s" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [Number(v).toFixed(2), "OOD distance"]} />
        {threshold != null && <ReferenceLine y={threshold} stroke={LACQUER} strokeDasharray="4 3" />}
        <Area type="monotone" dataKey="ood_distance" stroke={MOSS} strokeWidth={2} fill="url(#oodFill)" />
      </AreaChart>
    </ChartFrame>
  );
}

export interface ConformalBin {
  jg_lo: number;
  jg_hi: number;
  n_calib_samples: number;
  guaranteed_error_bound_deg: number;
}

/**
 * The conformal calibration curve itself — the held-out mapping from Jensen
 * Gain to a guaranteed rotation-error bound, with the live frame marked on it.
 */
export function ConformalCurveChart({
  bins,
  coverage,
  liveJg,
  liveBound,
}: {
  bins: ConformalBin[] | null;
  coverage: number | null;
  liveJg: number | null;
  liveBound: number | null;
}) {
  const data = (bins ?? [])
    .filter((b) => Number.isFinite(b.jg_hi) && b.jg_hi < 1000)
    .map((b) => ({
      jg: b.jg_lo,
      bound: b.guaranteed_error_bound_deg,
      samples: b.n_calib_samples,
    }));

  return (
    <ChartFrame
      title="Conformal calibration curve"
      caption={coverage != null ? `${(coverage * 100).toFixed(0)}% coverage` : undefined}
      empty={data.length === 0}
      emptyHint="The calibration table is unavailable from the perception module."
      height={220}
    >
      <LineChart data={data} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="jg" unit="°" {...axisProps} />
        <YAxis unit="°" {...axisProps} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: any, _n: any, p: any) => [
            `≤ ${Number(v).toFixed(1)}° (n=${p?.payload?.samples})`,
            "guaranteed error bound",
          ]}
          labelFormatter={(l: any) => `Jensen Gain ≥ ${l}°`}
        />
        <Line type="stepAfter" dataKey="bound" stroke={INK} strokeWidth={2} dot={{ r: 2, fill: INK }} />
        {liveJg != null && liveBound != null && (
          <ReferenceDot x={liveJg} y={liveBound} r={5} fill={LACQUER} stroke="#fff" strokeWidth={1.5} />
        )}
      </LineChart>
    </ChartFrame>
  );
}
