import { useEffect, useState } from "react";
import { useMissionControl } from "@/hooks/useMissionControl";
import { runScenario, fetchScenarios, type ScenarioInfo } from "@/lib/api";

/** Icon per scenario id — presentation only; every word of copy is the
 *  scenario library's own name and description. */
const ICONS: Record<string, { icon: string; iconColor: string; accent: string }> = {
  nominal: { icon: "flight_takeoff", iconColor: "text-moss-accent", accent: "border-moss-accent/30" },
  thermal: { icon: "thermostat", iconColor: "text-lacquer-red", accent: "border-lacquer-red/30" },
  perception: { icon: "visibility_off", iconColor: "text-amber-700", accent: "border-amber-500/30" },
  perfect_storm: { icon: "storm", iconColor: "text-rose-700", accent: "border-rose-500/30" },
};

const FALLBACK_ICON = { icon: "science", iconColor: "text-on-surface-variant", accent: "border-outline-variant" };

export function SimulationSection() {
  const { status, refreshAll } = useMissionControl();
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(5.0);
  const [catalogue, setCatalogue] = useState<ScenarioInfo[]>([]);

  useEffect(() => {
    fetchScenarios()
      .then((r) => setCatalogue(r.scenarios ?? []))
      .catch(() => setCatalogue([]));
  }, []);

  const scenarios = catalogue.map((sc) => ({
    id: sc.id,
    title: sc.name,
    desc: sc.description ?? "No description published for this scenario.",
    ...(ICONS[sc.id] ?? FALLBACK_ICON),
  }));

  const activeScenario = status?.current_scenario;
  const isScenarioRunning = status?.scenario_running || runningScenario !== null;

  const handleLaunchScenario = async (name: string) => {
    setRunningScenario(name);
    try {
      await runScenario(name, speed);
      await refreshAll();
    } catch (e) {
      console.error("Scenario launch failed", e);
    } finally {
      setTimeout(() => setRunningScenario(null), 3000);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter relative shadow-sm flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h2 className="text-xl font-bold text-ink-charcoal mb-1">
            Autonomous Rendezvous Simulation Testbed
          </h2>
          <p className="text-xs font-mono text-on-surface-variant">
            Execute synthetic telemetry scenarios across the 8-channel safety architecture.
          </p>
        </div>

        {/* Simulation Speed Control */}
        <div className="flex items-center gap-3 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/60 font-mono text-xs">
          <span className="text-on-surface-variant">Speed:</span>
          {[1.0, 5.0, 10.0].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                speed === s ? "bg-lacquer-red text-white" : "text-ink-charcoal hover:bg-surface-container-high"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Active Simulation Status Banner */}
      {isScenarioRunning && (
        <div className="p-4 rounded-xl bg-sim-violet/10 border border-sim-violet/30 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-sim-violet animate-ping"></span>
            <span className="font-bold text-sim-violet uppercase">
              Simulation Running: {activeScenario || runningScenario} ({speed}x real-time)
            </span>
          </div>
          <span className="text-on-surface-variant">Broadcasting to Redis Bus (CH_PERCEPTION, CH_COGNITION)</span>
        </div>
      )}

      {/* 4 Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
        {scenarios.map((sc) => (
          <div
            key={sc.id}
            className={`bg-surface-container-low rounded-xl border ${sc.accent} p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow`}
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className={`material-symbols-outlined text-3xl ${sc.iconColor}`}>{sc.icon}</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
                  {sc.id}
                </span>
              </div>
              <h3 className="text-base font-bold text-ink-charcoal mb-2">{sc.title}</h3>
              <p className="text-xs text-on-surface-variant font-mono leading-relaxed mb-6">
                {sc.desc}
              </p>
            </div>

            <button
              onClick={() => handleLaunchScenario(sc.id)}
              disabled={isScenarioRunning}
              className="w-full py-2.5 bg-paper-surface border border-outline-variant text-ink-charcoal text-xs font-mono font-bold uppercase rounded hover:border-lacquer-red hover:text-lacquer-red hover:bg-surface-container transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              {runningScenario === sc.id ? "LAUNCHING..." : "RUN SCENARIO"}
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 font-mono text-xs text-on-surface-variant">
        <strong className="text-ink-charcoal">Digital Twin Architecture:</strong> Scenarios synthesise Clohessy-Wiltshire state propagation, 10,000-D hyperdimensional situation vectors, and optical camera noise for closed-loop multi-agent consensus testing. Scenario telemetry is simulated and labelled as such — it is not a measurement of a real vehicle.
      </div>
    </div>
  );
}
