import { useCallback, useEffect, useRef, useState } from "react";
import { useMissionControl } from "@/hooks/useMissionControl";
import { processPerceptionFrame } from "@/lib/api";
import {
  fetchPerceptionHistory,
  fetchThresholds,
  setFrameInterval,
  type PerceptionFrame,
  type Thresholds,
} from "@/lib/armstrong";
import {
  ConformalCurveChart,
  JensenGainHistoryChart,
  OodHistoryChart,
  RangeHistoryChart,
} from "@/components/charts/TelemetryCharts";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The input stage of the whole system.
 *
 * A frame goes in; a 6-DoF pose and a calibrated uncertainty come out. Every
 * other number on this dashboard is downstream of this one call, which is why
 * it leads the page.
 *
 * Nothing here carries a fallback value. Before a frame is processed the
 * readouts say so — a stand-in number would be indistinguishable from a real
 * measurement, and this is the screen where that distinction matters most.
 */
export function PerceptionSection() {
  const { latest, modelStatus } = useMissionControl();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inferencing, setInferencing] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [frames, setFrames] = useState<PerceptionFrame[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [interval, setIntervalS] = useState<number | null>(null);
  const [intervalText, setIntervalText] = useState("");

  const p = latest.perception;

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetchPerceptionHistory(120);
      setFrames(res.frames);
      setIntervalS(res.frame_interval_s);
      setIntervalText(res.frame_interval_s != null ? String(res.frame_interval_s) : "");
    } catch {
      /* history is for plotting; a failed poll is not worth surfacing */
    }
  }, []);

  useEffect(() => {
    fetchThresholds().then(setThresholds).catch(() => setThresholds(null));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, p?.timestamp]);

  const submitFrame = useCallback(
    async (file: File) => {
      setError(null);
      setImageName(file.name);
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = reader.result as string;
        setCustomImage(b64);
        setInferencing(true);
        const t0 = performance.now();
        try {
          const res = await processPerceptionFrame(b64);
          setLastInferenceMs(
            typeof res?.inference_ms === "number" ? res.inference_ms : performance.now() - t0,
          );
          await loadHistory();
        } catch (err: any) {
          setError(err?.message || "The perception agent could not process this frame.");
        } finally {
          setInferencing(false);
        }
      };
      reader.onerror = () => setError("That file could not be read.");
      reader.readAsDataURL(file);
    },
    [loadHistory],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submitFrame(file);
  };

  const hasPose = Boolean(p && Array.isArray(p.t) && p.t.length >= 3);

  return (
    <div className="flex flex-col gap-gutter">
      {/* ── Frame input ─────────────────────────────────────────── */}
      <Reveal from="up">
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <header className="px-container-padding py-3 border-b border-outline-variant bg-surface-container flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="font-label-caps text-label-caps text-ink-charcoal uppercase tracking-widest font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-lacquer-red">photo_camera</span>
                Submit an Optical Frame
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Monocular image → 6-DoF pose → calibrated uncertainty. Everything below follows from this.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              {modelStatus?.info?.backbone && (
                <span className="text-on-surface-variant">
                  {modelStatus.info.backbone}
                  {modelStatus.info.epoch != null ? ` · epoch ${modelStatus.info.epoch}` : ""}
                </span>
              )}
              {lastInferenceMs != null && (
                <span className="text-moss-accent font-bold">{lastInferenceMs.toFixed(1)} ms</span>
              )}
            </div>
          </header>

          <div className="grid lg:grid-cols-2">
            {/* Dropzone / preview */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`relative min-h-[300px] flex items-center justify-center border-b lg:border-b-0 lg:border-r border-outline-variant transition-colors ${
                dragging ? "bg-lacquer-red/5" : "bg-surface-container-low"
              }`}
            >
              {customImage ? (
                <>
                  <img
                    src={customImage}
                    alt={imageName ? `Submitted frame: ${imageName}` : "Submitted frame"}
                    className="max-h-[360px] w-full object-contain"
                  />
                  {hasPose && (
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
                      <span className="font-mono text-[10px] bg-ink-charcoal/75 text-white px-2 py-1 rounded">
                        {imageName}
                      </span>
                      <span className="font-mono text-[10px] bg-ink-charcoal/75 text-white px-2 py-1 rounded">
                        range {Math.hypot(p!.t[0]!, p!.t[1]!, p!.t[2]!).toFixed(2)} m
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center px-8 py-12 flex flex-col items-center gap-4">
                  <span className="material-symbols-outlined text-[44px] text-outline-variant">
                    add_photo_alternate
                  </span>
                  <div>
                    <p className="font-headline-sm text-sm font-bold text-ink-charcoal mb-1">
                      Drop a frame here
                    </p>
                    <p className="font-mono text-[11px] text-on-surface-variant max-w-xs leading-relaxed">
                      No frame has been processed yet, so there is nothing to report downstream.
                      Submit an image of the target to start the pipeline.
                    </p>
                  </div>
                </div>
              )}

              {inferencing && (
                <div className="absolute inset-0 bg-paper-surface/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[28px] text-lacquer-red animate-spin">
                    progress_activity
                  </span>
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    Running pose inference…
                  </span>
                </div>
              )}
            </div>

            {/* Controls + pose output */}
            <div className="p-container-padding flex flex-col gap-4">
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={inferencing}
                  className="bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-widest px-5 py-3 rounded-lg hover:bg-primary transition-colors flex items-center gap-2 font-bold disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  {inferencing ? "Processing…" : customImage ? "Submit another frame" : "Choose a frame"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) submitFrame(f);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                {frames.length > 0 && (
                  <span className="font-mono text-[11px] text-on-surface-variant self-center">
                    {frames.length} frame{frames.length === 1 ? "" : "s"} processed
                  </span>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-lacquer-red/10 border border-lacquer-red/40 font-mono text-[11px] text-lacquer-red">
                  {error}
                </div>
              )}

              <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                Estimated 6-DoF pose
              </div>
              <div className="grid sm:grid-cols-2 gap-3 font-mono text-xs">
                <PoseBox
                  label="Quaternion [w, x, y, z]"
                  value={
                    p?.quaternion?.length
                      ? `[${p.quaternion.map((x) => Number(x).toFixed(4)).join(", ")}]`
                      : null
                  }
                />
                <PoseBox
                  label="Translation [x, y, z] (m)"
                  value={hasPose ? `[${p!.t.map((x) => Number(x).toFixed(3)).join(", ")}]` : null}
                />
              </div>

              {/* The one input the camera cannot provide */}
              <div className="pt-3 border-t border-outline-variant/50">
                <label
                  htmlFor="frame-interval"
                  className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold block mb-1.5"
                >
                  Capture interval between frames
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="frame-interval"
                    type="number"
                    min={0.01}
                    step={0.1}
                    value={intervalText}
                    placeholder="unset"
                    onChange={(e) => setIntervalText(e.target.value)}
                    onBlur={async () => {
                      const parsed = intervalText.trim() === "" ? null : Number(intervalText);
                      if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
                        setIntervalText(interval != null ? String(interval) : "");
                        return;
                      }
                      try {
                        const r = await setFrameInterval(parsed);
                        setIntervalS(r.frame_interval_s);
                        await loadHistory();
                      } catch {
                        setIntervalText(interval != null ? String(interval) : "");
                      }
                    }}
                    className="w-28 font-mono text-sm px-2.5 py-1.5 rounded border border-outline-variant bg-surface-container text-ink-charcoal focus:outline-none focus:border-lacquer-red"
                  />
                  <span className="font-mono text-[11px] text-on-surface-variant">seconds</span>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                      interval != null && frames.length >= 2
                        ? "bg-moss-accent/10 text-moss-accent"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {interval == null
                      ? "velocity unavailable"
                      : frames.length < 2
                        ? "needs a second frame"
                        : "velocity derived"}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
                  An image gives position, not motion. Declaring how far apart the frames were
                  captured is what turns two pose fixes into a closing rate — upload timing would
                  only measure how fast you clicked.
                </p>
              </div>

              {thresholds?.hopf_anchors != null && (
                <p className="font-mono text-[10px] text-on-surface-variant leading-relaxed">
                  Rotation is scored against {thresholds.hopf_anchors} SO(3) anchors
                  {thresholds.hopf_elevation && thresholds.hopf_inplane
                    ? ` (${thresholds.hopf_elevation} directions × ${thresholds.hopf_inplane} in-plane)`
                    : ""}
                  . The spread across those anchors is the Jensen Gain.
                </p>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── Evidence channels ───────────────────────────────────── */}
      <Reveal from="up" delay={70}>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <EvidenceCard
            label="Jensen Gain Spread"
            value={p?.jensen_gain != null ? `${p.jensen_gain.toFixed(2)}°` : null}
            limit={
              thresholds ? `trust limit ${thresholds.moderate_thresh_deg.toFixed(1)}°` : null
            }
            ok={
              thresholds && p?.jensen_gain != null
                ? p.jensen_gain < thresholds.moderate_thresh_deg
                : null
            }
            footer={
              p?.calibrated_error_bound_deg != null && thresholds?.conformal
                ? `rotation error ≤ ${p.calibrated_error_bound_deg.toFixed(1)}° at ${(thresholds.conformal.coverage * 100).toFixed(0)}% coverage`
                : null
            }
          />
          <EvidenceCard
            label="Physics Cross-Check"
            value={p?.physics_residual_m != null ? `${p.physics_residual_m.toFixed(2)} m` : null}
            limit={
              thresholds?.physics_residual_threshold_m != null
                ? `residual ≤ ${thresholds.physics_residual_threshold_m.toFixed(2)} m`
                : null
            }
            ok={p?.physics_consistent ?? null}
            footer={
              p == null
                ? null
                : p.physics_consistent
                  ? "CWH dynamics consistent"
                  : "orbital jump violation"
            }
          />
          <EvidenceCard
            label="OOD Distance"
            value={p?.ood_distance != null ? p.ood_distance.toFixed(2) : null}
            limit={
              thresholds?.ood_threshold_99th != null
                ? `99th pct ≤ ${thresholds.ood_threshold_99th.toFixed(1)}`
                : null
            }
            ok={p?.is_in_distribution ?? null}
            footer={
              p == null
                ? null
                : p.is_in_distribution
                  ? "in-distribution"
                  : "out-of-distribution — pose untrusted"
            }
          />
          <EvidenceCard
            label="Redundant PnP Solver"
            value={
              p?.cross_estimator_agreement == null
                ? null
                : p.cross_estimator_agreement
                  ? "AGREE"
                  : "DISAGREE"
            }
            limit={
              p?.rotation_disagreement_deg != null
                ? `geodesic Δ ${p.rotation_disagreement_deg.toFixed(1)}°`
                : null
            }
            ok={p?.cross_estimator_agreement ?? null}
            footer="ORB + EPnP, independent of the network"
          />
        </div>
      </Reveal>

      {/* ── Graphs ──────────────────────────────────────────────── */}
      <Reveal from="up" delay={120}>
        <div className="grid lg:grid-cols-2 gap-4">
          <JensenGainHistoryChart
            frames={frames}
            highThresh={thresholds?.high_confidence_thresh_deg ?? null}
            moderateThresh={thresholds?.moderate_thresh_deg ?? null}
          />
          <ConformalCurveChart
            bins={thresholds?.conformal?.bins ?? null}
            coverage={thresholds?.conformal?.coverage ?? null}
            liveJg={p?.jensen_gain ?? null}
            liveBound={p?.calibrated_error_bound_deg ?? null}
          />
          <RangeHistoryChart frames={frames} />
          <OodHistoryChart frames={frames} threshold={thresholds?.ood_threshold_99th ?? null} />
        </div>
      </Reveal>

      {p?.confidence_label && (
        <Reveal from="up" delay={160}>
          <div
            className={`p-4 rounded-xl border ${
              p.confidence_level === "high"
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-900"
                : p.confidence_level === "moderate"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-900"
                  : "bg-lacquer-red/10 border-lacquer-red/40 text-lacquer-red"
            }`}
          >
            <div className="font-label-caps text-xs font-bold uppercase mb-1">
              Calibrated confidence assessment
            </div>
            <div className="text-xs leading-relaxed">{p.confidence_label}</div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

function PoseBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-surface-container-low p-2.5 rounded border border-outline-variant/60">
      <div className="text-[10px] text-on-surface-variant mb-1 uppercase font-bold">{label}</div>
      <div className={value ? "text-ink-charcoal font-bold" : "text-on-surface-variant"}>
        {value ?? "awaiting a frame"}
      </div>
    </div>
  );
}

function EvidenceCard({
  label,
  value,
  limit,
  ok,
  footer,
}: {
  label: string;
  value: string | null;
  limit: string | null;
  ok: boolean | null;
  footer: string | null;
}) {
  const tone =
    ok == null ? "text-on-surface-variant" : ok ? "text-moss-accent" : "text-lacquer-red";
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 flex flex-col justify-between shadow-sm min-h-[142px]">
      <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
        {label}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center my-2">
        <span className={`font-mono text-2xl font-bold ${value ? tone : "text-outline-variant"}`}>
          {value ?? "—"}
        </span>
        {limit && (
          <span className="font-mono text-[10px] text-on-surface-variant mt-1 text-center">
            {limit}
          </span>
        )}
      </div>
      <div
        className={`text-[10px] font-mono p-1.5 rounded text-center ${
          ok == null
            ? "bg-surface-container text-on-surface-variant"
            : ok
              ? "bg-moss-accent/10 text-moss-accent"
              : "bg-lacquer-red/10 text-lacquer-red"
        }`}
      >
        {footer ?? "awaiting a frame"}
      </div>
    </div>
  );
}
