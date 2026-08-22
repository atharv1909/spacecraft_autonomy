import { createFileRoute, redirect } from "@tanstack/react-router";

/** /armstrong has no landing screen of its own — the flow starts at step 1. */
export const Route = createFileRoute("/armstrong/")({
  beforeLoad: () => {
    throw redirect({ to: "/armstrong/pathway", replace: true });
  },
});
