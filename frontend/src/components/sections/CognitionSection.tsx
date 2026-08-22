import { useMissionControl } from "@/hooks/useMissionControl";

/**
 * The cognition agent's own output, and nothing else.
 *
 * The causal graph can only reason about subsystems it has actually been told
 * about. Fed by a camera, that means the optical chain: pose ambiguity, novelty
 * against the case library, and the action it recommends as a result. Where the
 * agent has published no state for a field, the field says so — a plausible
 * subsystem cascade drawn in a mission-control panel is indistinguishable from
 * a measured one.
 */
export function CognitionSection() {
  const { latest } = useMissionControl();
  const c = latest.cognition as any;
  const payload = c?.payload ?? c ?? null;

  const narrative =
    payload?.root_cause_narrative ??
    (typeof payload?.explanation === "object"
      ? payload.explanation?.narrative
      : payload?.explanation) ??
    null;
  const rootCause = payload?.root_cause ?? null;
  const anomaly = payload?.anomaly_detected ?? null;
  const anomalyType = payload?.anomaly_type ?? null;
  const novelty = payload?.novelty_score ?? null;
  const recAction = payload?.recommended_action ?? null;
  const actionConfidence = payload?.action_confidence ?? null;
  const maxSimilarity = payload?.max_similarity ?? null;

  const subStates: Record<string, string> | null = payload?.subsystem_states ?? null;
  const influence: Record<string, number> | null =
    (typeof payload?.explanation === "object"
      ? payload.explanation?.component_breakdown
      : null) ??
    payload?.component_breakdown ??
    payload?.component_influence ??
    null;
  const heatmap =
    typeof payload?.explanation === "object" ? payload.explanation?.similarity_heatmap : null;

  if (!c) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center flex flex-col items-center gap-3 shadow-sm">
        <span className="material-symbols-outlined text-[40px] text-outline-variant">psychology</span>
        <p className="font-mono text-xs text-on-surface-variant max-w-md leading-relaxed">
          The cognition agent has not published a situation vector yet. It binds a hypervector once
          a pose estimate reaches the bus.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gutter">
      {/* Root-cause banner */}
      <div className="bg-surface-container-lowest border border-lacquer-red/40 rounded-xl p-gutter relative overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-lacquer-red/5" />
        <div className="relative flex items-start gap-4">
          <span className="material-symbols-outlined text-3xl text-lacquer-red pt-1">account_tree</span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <span className="font-label-caps text-xs px-2 py-0.5 bg-lacquer-red text-white rounded font-bold">
                Root-Cause Graph Traversal
              </span>
              <span className="text-xs font-mono text-on-surface-variant">
                {novelty != null ? `novelty ${(Number(novelty) * 100).toFixed(1)}%` : "novelty —"}
                {" · "}
                {anomaly == null ? "anomaly —" : anomaly ? "ANOMALY DETECTED" : "nominal"}
                {anomalyType && anomalyType !== "none" ? ` · ${anomalyType.replace(/_/g, " ")}` : ""}
              </span>
            </div>
            <h2 className="text-base font-bold text-ink-charcoal leading-snug mb-1">
              {narrative ?? "No causal narrative published for this situation."}
            </h2>
            {rootCause && (
              <p className="font-label-caps text-xs text-on-surface-variant">
                Intervention directed at the upstream root ({String(rootCause).toUpperCase()}) rather
                than the downstream symptoms.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-gutter">
        {/* Recommendation */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-gutter shadow-sm flex flex-col gap-3">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">neurology</span>
            Associative Memory Recall
          </h3>
          <dl className="font-mono text-xs flex flex-col gap-1.5">
            <Row label="Recommended action" value={recAction ? String(recAction).toUpperCase() : null} />
            <Row
              label="Action confidence"
              value={actionConfidence != null ? `${(Number(actionConfidence) * 100).toFixed(1)}%` : null}
            />
            <Row
              label="Closest case similarity"
              value={maxSimilarity != null ? Number(maxSimilarity).toFixed(3) : null}
            />
            <Row label="Situation id" value={payload?.situation_id ?? null} />
          </dl>

          {Array.isArray(heatmap) && heatmap.length > 0 && (
            <div className="mt-1">
              <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-2">
                Nearest cases
              </div>
              <div className="flex flex-col gap-1">
                {heatmap.slice(0, 5).map((h: any) => (
                  <div
                    key={h.case_id}
                    className="flex items-center justify-between gap-2 font-mono text-[11px] px-2.5 py-1.5 rounded bg-surface-container-low border border-outline-variant/40"
                  >
                    <span className="text-on-surface-variant">#{h.case_id}</span>
                    <span className="text-ink-charcoal truncate">{h.action}</span>
                    <span className="font-bold text-moss-accent">{h.similarity_pct}%</span>
                    <span className="text-on-surface-variant">{h.outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Component influence — a real bar chart of the agent's own weights */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-gutter shadow-sm">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">insights</span>
            Component Influence on the Decision
          </h3>
          {influence && Object.keys(influence).length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {Object.entries(influence).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] w-32 shrink-0 text-on-surface-variant capitalize">
                    {k.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-2.5 rounded bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full bg-lacquer-red rounded transition-all duration-700"
                      style={{ width: `${Math.min(100, Number(v))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold w-10 text-right text-ink-charcoal">
                    {Number(v).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[11px] text-on-surface-variant">
              The agent has not published a component breakdown for this situation.
            </p>
          )}
        </div>
      </div>

      {/* Subsystem states, only if the agent actually published them */}
      {subStates && Object.keys(subStates).length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-gutter shadow-sm">
          <h3 className="font-label-caps text-xs text-ink-charcoal uppercase font-bold tracking-wider mb-3">
            Causal Graph Node States
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
            {Object.entries(subStates).map(([node, state]) => (
              <div
                key={node}
                className="p-3 rounded-lg border bg-surface-container-low border-outline-variant/50"
              >
                <div className="text-[10px] uppercase text-on-surface-variant">
                  {node.replace(/_/g, " ")}
                </div>
                <div
                  className={`font-bold mt-1 ${
                    state === "nominal"
                      ? "text-moss-accent"
                      : state === "degraded"
                        ? "text-amber-700"
                        : "text-lacquer-red"
                  }`}
                >
                  {String(state).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-outline-variant/30 pb-1">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={value ? "font-bold text-ink-charcoal text-right break-all" : "text-outline-variant"}>
        {value ?? "not published"}
      </dd>
    </div>
  );
}
