import { Link } from "@tanstack/react-router";

export type WizardStep = "pathway" | "parameters" | "review";

const STEPS: Array<{ id: WizardStep; index: number; label: string; to: string }> = [
  { id: "pathway", index: 1, label: "Pathway", to: "/armstrong/pathway" },
  { id: "parameters", index: 2, label: "Parameters", to: "/armstrong/parameters" },
  { id: "review", index: 3, label: "Safety Review", to: "/armstrong/review" },
];

/**
 * The one stepper used by all three wizard screens.
 *
 * Three states, one visual language: a completed step is a filled moss circle
 * with a check, the active step is a filled lacquer circle with its number, and
 * an upcoming step is a hollow outline. Completed steps are clickable so an
 * operator can walk back without losing their selection.
 */
export function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Override progress" className="flex items-center justify-center gap-0 py-2">
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
        const circle = (
          <span
            className={[
              "w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-all duration-300",
              state === "done"
                ? "bg-moss-accent border-moss-accent text-white"
                : state === "active"
                  ? "bg-lacquer-red border-lacquer-red text-white shadow-md scale-110"
                  : "bg-transparent border-outline-variant text-on-surface-variant",
            ].join(" ")}
          >
            {state === "done" ? (
              <span className="material-symbols-outlined text-[16px]">check</span>
            ) : (
              step.index
            )}
          </span>
        );

        return (
          <div key={step.id} className="flex items-center">
            {i > 0 && (
              <span
                className={`h-[2px] w-10 sm:w-20 transition-colors duration-500 ${
                  i <= currentIndex ? "bg-moss-accent/60" : "bg-outline-variant/50"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5 px-2">
              {state === "done" ? (
                <Link to={step.to} aria-label={`Back to ${step.label}`} className="cursor-pointer">
                  {circle}
                </Link>
              ) : (
                circle
              )}
              <span
                className={`font-label-caps text-[10px] uppercase tracking-[0.14em] whitespace-nowrap ${
                  state === "active"
                    ? "text-lacquer-red font-bold"
                    : state === "done"
                      ? "text-moss-accent font-bold"
                      : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
