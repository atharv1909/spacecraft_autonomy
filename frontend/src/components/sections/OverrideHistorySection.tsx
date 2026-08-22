import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchOverrides, type OverrideRecord } from "@/lib/armstrong";
import { createMissionWebSocket } from "@/lib/api";
import { TiltCard } from "@/components/motion/TiltCard";

/**
 * Dashboard view of every override an operator has committed through the
 * Armstrong Console. This is the far end of the loop: the parameters typed into
 * the wizard, the rationale written before commit, and the ledger hash the
 * decision was chained under all surface here after the fact.
 */
export function OverrideHistorySection() {
  const [records, setRecords] = useState<OverrideRecord[]>([]);
  const [audit, setAudit] = useState<{ valid: boolean; entries_verified?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchOverrides();
      setRecords(data.overrides);
      setAudit(data.audit);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Unable to reach the override ledger");
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh the moment a commit lands rather than polling on a timer.
    const cleanup = createMissionWebSocket((msg) => {
      if (msg?.type === "system_event" && msg.event === "armstrong_override_committed") {
        load();
      }
    });
    const interval = setInterval(load, 15000);
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="flex flex-col gap-gutter">
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        <header className="px-container-padding py-3 border-b border-outline-variant bg-surface-container flex flex-wrap justify-between items-center gap-3">
          <h2 className="font-label-caps text-label-caps text-ink-charcoal uppercase tracking-widest flex items-center gap-2 font-bold">
            <span className="material-symbols-outlined text-[18px] text-lacquer-red">how_to_reg</span>
            Committed Operator Overrides
          </h2>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-on-surface-variant">{records.length} committed</span>
            {audit && (
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  audit.valid
                    ? "bg-emerald-500/10 text-emerald-800"
                    : "bg-lacquer-red/10 text-lacquer-red"
                }`}
              >
                SHA-256 CHAIN {audit.valid ? "VALID" : "BROKEN"} · {audit.entries_verified ?? 0} entries
              </span>
            )}
          </div>
        </header>

        {error ? (
          <div className="p-8 text-center font-mono text-xs text-lacquer-red">{error}</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-[40px] text-outline-variant">
              shield_with_heart
            </span>
            <p className="font-mono text-xs text-on-surface-variant max-w-md">
              No human override has been committed yet. Open the Armstrong Console to select a
              recovery pathway, tune its parameters, and commit a maneuver — it will appear here
              with its full parameter set and ledger hash.
            </p>
            <Link
              to="/armstrong/pathway"
              className="bg-lacquer-red text-white font-label-caps text-[11px] uppercase tracking-widest px-5 py-3 rounded-lg hover:bg-primary transition-colors font-bold"
            >
              Open Armstrong Console
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/50">
            {records.map((rec) => {
              const open = expanded === rec.entry_hash;
              const failed = Object.entries(rec.precommit).filter(([, ok]) => !ok);
              return (
                <div key={rec.entry_hash} className="p-container-padding">
                  <button
                    onClick={() => setExpanded(open ? null : rec.entry_hash)}
                    className="w-full text-left flex flex-wrap items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            rec.override_level === "reject"
                              ? "bg-lacquer-red text-white"
                              : "bg-lacquer-red/10 text-lacquer-red"
                          }`}
                        >
                          L{{ acknowledge: 1, modify: 2, replace: 3, reject: 4 }[rec.override_level] ?? "?"}{" "}
                          {rec.override_level}
                        </span>
                        <span className="font-headline-sm text-sm font-bold text-ink-charcoal">
                          {rec.pathway_title}
                        </span>
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          → {rec.resulting_action.toUpperCase()}
                        </span>
                        {rec.precommit_overridden && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-800">
                            COMMITTED OVER {failed.length} FAILED CHECK
                            {failed.length === 1 ? "" : "S"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-charcoal/80 line-clamp-2">{rec.rationale}</p>
                    </div>
                    <div className="text-right font-mono text-[11px] text-on-surface-variant shrink-0">
                      <div>{rec.time} UTC</div>
                      <div className="text-lacquer-red">{rec.operator}</div>
                      <div className="mt-1 flex items-center gap-1 justify-end">
                        {open ? "Hide" : "Detail"}
                        <span className="material-symbols-outlined text-[14px]">
                          {open ? "expand_less" : "expand_more"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {open && (
                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                      <TiltCard
                        maxTilt={3}
                        lift={4}
                        glare={false}
                        className="rounded-lg bg-surface-container-low border border-outline-variant/50 p-4"
                      >
                        <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-3">
                          Operator Parameters
                        </div>
                        <dl className="font-mono text-xs flex flex-col gap-1.5">
                          {Object.entries(rec.parameters).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3 border-b border-outline-variant/30 pb-1">
                              <dt className="text-on-surface-variant">{k}</dt>
                              <dd className="font-bold text-ink-charcoal">{Number(v).toFixed(3)}</dd>
                            </div>
                          ))}
                          {rec.preset && (
                            <div className="flex justify-between gap-3 pt-1">
                              <dt className="text-on-surface-variant">seeded from preset</dt>
                              <dd className="font-bold text-moss-accent">{rec.preset}</dd>
                            </div>
                          )}
                        </dl>
                      </TiltCard>

                      <TiltCard
                        maxTilt={3}
                        lift={4}
                        glare={false}
                        className="rounded-lg bg-surface-container-low border border-outline-variant/50 p-4"
                      >
                        <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-3">
                          Committed Outcome
                        </div>
                        <dl className="font-mono text-xs flex flex-col gap-1.5">
                          <Row
                            label="Jensen Gain"
                            value={`${rec.jensen_gain_at_open_deg.toFixed(2)}° → ${rec.predicted_jensen_gain_deg.toFixed(2)}°`}
                          />
                          <Row label="ΔV expended" value={`${rec.delta_v_mps.toFixed(4)} m/s`} />
                          <Row
                            label="Manoeuvre duration"
                            value={`${rec.command_duration_s.toFixed(1)} s`}
                          />
                          <Row
                            label="Collision bound (99%)"
                            value={`${(rec.collision_prob_upper_bound_99 * 100).toFixed(2)}%`}
                          />
                          <Row label="Situation" value={rec.situation_id} />
                          <Row label="Session" value={rec.session_id} />
                        </dl>
                        <div className="mt-3 pt-3 border-t border-outline-variant/40">
                          <div className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-2">
                            Pre-Commit Gates
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(rec.precommit).map(([id, ok]) => (
                              <span
                                key={id}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                  ok
                                    ? "bg-emerald-500/10 text-emerald-800"
                                    : "bg-lacquer-red/10 text-lacquer-red"
                                }`}
                              >
                                {ok ? "✓" : "✗"} {id.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-outline-variant/40 font-mono text-[10px] text-on-surface-variant break-all">
                          <span className="font-bold text-ink-charcoal">Ledger hash:</span>{" "}
                          {rec.entry_hash}
                        </div>
                      </TiltCard>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-outline-variant/30 pb-1">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-bold text-ink-charcoal text-right break-all">{value}</dd>
    </div>
  );
}
