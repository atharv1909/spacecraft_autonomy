import { useMemo } from "react";

interface TrajectoryFrameProps {
  /** Chaser position in the CWH frame, metres. */
  rVec: number[];
  /** Chaser relative velocity, m/s. Drawn as a heading vector. */
  vVec?: number[] | undefined;
  /** Mean predicted path, [[x, y, z], …] in the CWH frame. */
  trajectory?: number[][] | undefined;
  /** Keep-out sphere radius, metres. */
  keepoutM?: number | undefined;
  /** Approach cone half-angle, degrees. */
  coneHalfAngleDeg?: number | undefined;
  /** Label shown top-left. */
  label?: string | undefined;
  /** Caption shown top-right, e.g. the active parameter preset. */
  caption?: string | undefined;
  className?: string | undefined;
  height?: number | undefined;
}

/**
 * The R-bar / V-bar plan view, shared by the dashboard overview and the
 * Armstrong Console. One implementation, driven entirely by the numbers passed
 * in — there is no decorative path baked into the markup.
 *
 * Projection is the CWH x (R-bar, radial) against y (V-bar, along-track), which
 * is the plane a proximity-operations approach is actually flown in.
 */
export function TrajectoryFrame({
  rVec,
  vVec,
  trajectory,
  keepoutM = 2,
  coneHalfAngleDeg = 20,
  label = "LIVE R-BAR / V-BAR FRAME",
  caption,
  className = "",
  height = 320,
}: TrajectoryFrameProps) {
  const W = 640;
  const H = height;

  const view = useMemo(() => {
    const pts: Array<[number, number]> = [[rVec[0] ?? 0, rVec[1] ?? 0]];
    if (trajectory) for (const p of trajectory) pts.push([p[0] ?? 0, p[1] ?? 0]);

    // Frame the target, the chaser and the whole predicted path with margin.
    const extent = pts.reduce(
      (acc, [x, y]) => Math.max(acc, Math.abs(x), Math.abs(y)),
      keepoutM * 2.5,
    );
    const span = extent * 1.25;

    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) / (2 * span);

    // R-bar runs up the page, V-bar runs to the right.
    const project = (x: number, y: number): [number, number] => [cx + y * scale, cy - x * scale];

    return { project, scale, span, cx, cy };
  }, [rVec, trajectory, keepoutM, H]);

  const { project, scale, cx, cy, span } = view;
  const [px, py] = project(rVec[0] ?? 0, rVec[1] ?? 0);

  const pathD = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return "";
    return trajectory
      .map((p, i) => {
        const [sx, sy] = project(p[0] ?? 0, p[1] ?? 0);
        return `${i === 0 ? "M" : "L"} ${sx.toFixed(2)} ${sy.toFixed(2)}`;
      })
      .join(" ");
  }, [trajectory, project]);

  // 20-degree approach cone, opening along +R-bar (up the page).
  const coneRad = (coneHalfAngleDeg * Math.PI) / 180;
  const coneLen = span * 1.4 * scale;
  const coneLeft = `${cx} ${cy} L ${cx - Math.sin(coneRad) * coneLen} ${cy - Math.cos(coneRad) * coneLen}`;
  const coneRight = `${cx} ${cy} L ${cx + Math.sin(coneRad) * coneLen} ${cy - Math.cos(coneRad) * coneLen}`;

  const vx = vVec?.[0] ?? 0;
  const vy = vVec?.[1] ?? 0;
  const vMag = Math.hypot(vx, vy);
  const headingEnd =
    vVec && vMag > 1e-9
      ? project(
          (rVec[0] ?? 0) + (vx / vMag) * span * 0.18,
          (rVec[1] ?? 0) + (vy / vMag) * span * 0.18,
        )
      : null;

  const gridStep = niceStep(span);

  return (
    <div
      className={`relative rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden ${className}`}
    >
      <div className="absolute top-0 inset-x-0 z-10 flex justify-between items-start p-3 pointer-events-none">
        <span className="font-label-caps text-[10px] uppercase tracking-[0.16em] text-on-surface-variant font-bold">
          {label}
        </span>
        {caption && (
          <span className="font-mono text-[10px] text-lacquer-red font-bold text-right max-w-[55%]">
            {caption}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height }} role="img"
           aria-label={`Relative trajectory plan view. Chaser at R-bar ${(rVec[0] ?? 0).toFixed(2)} metres, V-bar ${(rVec[1] ?? 0).toFixed(2)} metres.`}>
        {/* Metric grid */}
        {gridLines(span, gridStep).map((m) => {
          const [gx] = project(0, m);
          const [, gy] = project(m, 0);
          return (
            <g key={m}>
              <line x1={gx} y1={0} x2={gx} y2={H} stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
              <line x1={0} y1={gy} x2={W} y2={gy} stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
            </g>
          );
        })}

        {/* Axes */}
        <line x1={cx} y1={0} x2={cx} y2={H} stroke="rgba(0,0,0,0.16)" strokeWidth="1" />
        <line x1={0} y1={cy} x2={W} y2={cy} stroke="rgba(0,0,0,0.16)" strokeWidth="1" />

        {/* Approach cone */}
        <path d={`M ${coneLeft}`} stroke="#5C6300" strokeWidth="1" strokeDasharray="5 4" fill="none" opacity="0.6" />
        <path d={`M ${coneRight}`} stroke="#5C6300" strokeWidth="1" strokeDasharray="5 4" fill="none" opacity="0.6" />
        <path
          d={`M ${cx} ${cy} L ${cx - Math.sin(coneRad) * coneLen} ${cy - Math.cos(coneRad) * coneLen} L ${cx + Math.sin(coneRad) * coneLen} ${cy - Math.cos(coneRad) * coneLen} Z`}
          fill="#5C6300"
          opacity="0.05"
        />

        {/* Keep-out sphere */}
        <circle cx={cx} cy={cy} r={Math.max(2, keepoutM * scale)} fill="#7A221E" opacity="0.1" />
        <circle
          cx={cx}
          cy={cy}
          r={Math.max(2, keepoutM * scale)}
          fill="none"
          stroke="#7A221E"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          opacity="0.75"
        />

        {/* Target */}
        <circle cx={cx} cy={cy} r="4" fill="#1a1a1a" />

        {/* Predicted path */}
        {pathD && (
          <>
            <path d={pathD} fill="none" stroke="#5C6300" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            <path d={pathD} fill="none" stroke="#5C6300" strokeWidth="8" strokeLinecap="round" opacity="0.1" />
          </>
        )}

        {/* Velocity heading */}
        {headingEnd && (
          <line
            x1={px}
            y1={py}
            x2={headingEnd[0]}
            y2={headingEnd[1]}
            stroke="#7A221E"
            strokeWidth="1.6"
            markerEnd="url(#arrow)"
            opacity="0.85"
          />
        )}
        <defs>
          <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#7A221E" />
          </marker>
        </defs>

        {/* Chaser */}
        <circle cx={px} cy={py} r="6" fill="#7A221E" />
        <circle cx={px} cy={py} r="13" fill="none" stroke="#7A221E" strokeWidth="1.4" opacity="0.4">
          <animate attributeName="r" values="8;18;8" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div className="absolute bottom-0 inset-x-0 flex justify-between items-end p-3 pointer-events-none font-mono text-[10px] text-on-surface-variant">
        <span>
          R-bar {(rVec[0] ?? 0).toFixed(2)} m · V-bar {(rVec[1] ?? 0).toFixed(2)} m
        </span>
        <span>
          grid {gridStep} m · keep-out {keepoutM.toFixed(1)} m · cone ±{coneHalfAngleDeg}°
        </span>
      </div>
    </div>
  );
}

/** Pick a round grid spacing that yields roughly 4–8 divisions. */
function niceStep(span: number): number {
  const raw = span / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  for (const m of [1, 2, 5, 10]) {
    if (raw <= m * mag) return m * mag;
  }
  return 10 * mag;
}

function gridLines(span: number, step: number): number[] {
  const out: number[] = [];
  for (let v = -span; v <= span; v += step) {
    if (Math.abs(v) > 1e-9) out.push(Number(v.toFixed(4)));
  }
  return out;
}
