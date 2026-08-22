import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ArmstrongProvider } from "@/components/armstrong/ArmstrongContext";

/**
 * Layout route for the override wizard.
 *
 * The provider sits here rather than inside each step so the session, the
 * countdown and the operator's selection survive navigation between
 * /armstrong/pathway, /armstrong/parameters and /armstrong/review.
 */
export const Route = createFileRoute("/armstrong")({
  head: () => ({
    meta: [
      { title: "Armstrong Console — SYMBIOSIS" },
      {
        name: "description",
        content:
          "Human-in-the-loop override console: select a recovery pathway, tune its physical parameters, and commit under a tamper-evident audit chain.",
      },
    ],
  }),
  component: ArmstrongLayout,
});

function ArmstrongLayout() {
  return (
    <ArmstrongProvider>
      <Outlet />
    </ArmstrongProvider>
  );
}
