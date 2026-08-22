import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  openSession,
  getSession,
  type ArmstrongSession,
  type Evaluation,
  type OverrideLevel,
  type RecoveryPathway,
} from "@/lib/armstrong";

/**
 * Wizard-wide state for the Armstrong Console.
 *
 * Two things live here on purpose:
 *
 *  1. **One countdown.** The deadline is anchored server-side on the session
 *     (`deadline_ts`); this provider ticks a single interval against it and
 *     every header and footer in the flow reads the same value. Per-screen
 *     timers would drift, and a drifting clock on a safety-critical countdown
 *     is worse than no clock.
 *
 *  2. **One selection.** Pathway, parameter values and rationale survive
 *     navigation between steps, which is what makes "Back to Pathway Selection"
 *     and "Start Over" behave the way an operator expects.
 */

interface ArmstrongState {
  session: ArmstrongSession | null;
  loading: boolean;
  error: string | null;

  /** Seconds left on the server-anchored deadline. */
  remaining: number;
  expired: boolean;

  pathwayId: string | null;
  pathway: RecoveryPathway | null;
  values: Record<string, number>;
  presetId: string | null;
  evaluation: Evaluation | null;
  rationale: string;
  operator: string;

  /** True once a commit has landed; used to stop the countdown. */
  committed: boolean;

  start: (level: OverrideLevel) => Promise<void>;
  selectPathway: (id: string) => void;
  setValues: (values: Record<string, number>) => void;
  setPresetId: (id: string | null) => void;
  setEvaluation: (evaluation: Evaluation | null) => void;
  setRationale: (text: string) => void;
  setOperator: (name: string) => void;
  markCommitted: () => void;
  reset: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const ArmstrongCtx = createContext<ArmstrongState | null>(null);

export function useArmstrong(): ArmstrongState {
  const ctx = useContext(ArmstrongCtx);
  if (!ctx) throw new Error("useArmstrong must be used inside <ArmstrongProvider>");
  return ctx;
}

export function ArmstrongProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ArmstrongSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  const [pathwayId, setPathwayId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [presetId, setPresetId] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [rationale, setRationale] = useState("");
  const [operator, setOperator] = useState("commander");
  const [committed, setCommitted] = useState(false);

  const startedRef = useRef(false);

  const start = useCallback(async (level: OverrideLevel) => {
    setLoading(true);
    setError(null);
    try {
      const s = await openSession(level);
      setSession(s);
      setRemaining(Math.max(0, s.deadline_ts * 1000 - Date.now()) / 1000);
    } catch (e: any) {
      setError(e?.message || "Could not open an Armstrong session");
    } finally {
      setLoading(false);
    }
  }, []);

  // Open a session on first mount of the wizard. Section 5 hands off which
  // escalation level was pressed; anything else defaults to L2 Modify.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let level: OverrideLevel = "modify";
    try {
      const handoff = sessionStorage.getItem("armstrong:level");
      if (handoff === "modify" || handoff === "replace") level = handoff;
      sessionStorage.removeItem("armstrong:level");
    } catch {
      // No storage available — L2 is the safe default.
    }
    start(level);
  }, [start]);

  // The single countdown. Derived from the server deadline every tick rather
  // than decremented, so a slow tab cannot desynchronise it.
  useEffect(() => {
    if (!session || committed) return;
    const tick = () => {
      setRemaining(Math.max(0, (session.deadline_ts * 1000 - Date.now()) / 1000));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [session, committed]);

  const refreshSession = useCallback(async () => {
    if (!session) return;
    try {
      const s = await getSession(session.session_id);
      setSession(s);
    } catch {
      // A dropped refresh is not fatal — the deadline is already anchored and
      // the next poll will pick the session back up.
    }
  }, [session]);

  // Re-poll so the live Jensen Gain / crew-notified state stays current while
  // the operator is mid-flow.
  useEffect(() => {
    if (!session || committed) return;
    const id = setInterval(refreshSession, 5000);
    return () => clearInterval(id);
  }, [session, committed, refreshSession]);

  const selectPathway = useCallback((id: string) => {
    setPathwayId((prev) => {
      if (prev !== id) {
        // A different pathway has different knobs entirely — drop the old ones
        // rather than carrying stale keys into the next step.
        setValues({});
        setPresetId(null);
        setEvaluation(null);
      }
      return id;
    });
  }, []);

  const reset = useCallback(async () => {
    setPathwayId(null);
    setValues({});
    setPresetId(null);
    setEvaluation(null);
    setRationale("");
    setCommitted(false);
    await start(session?.level ?? "modify");
  }, [start, session?.level]);

  const pathway = useMemo(
    () => session?.pathways.find((p) => p.id === pathwayId) ?? null,
    [session, pathwayId],
  );

  const value: ArmstrongState = {
    session,
    loading,
    error,
    remaining,
    expired: !committed && remaining <= 0 && !!session,
    pathwayId,
    pathway,
    values,
    presetId,
    evaluation,
    rationale,
    operator,
    committed,
    start,
    selectPathway,
    setValues,
    setPresetId,
    setEvaluation,
    setRationale,
    setOperator,
    markCommitted: () => setCommitted(true),
    reset,
    refreshSession,
  };

  return <ArmstrongCtx.Provider value={value}>{children}</ArmstrongCtx.Provider>;
}
