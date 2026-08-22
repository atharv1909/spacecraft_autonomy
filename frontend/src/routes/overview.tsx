import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/overview")({
  component: RedirectToOverview,
});

function RedirectToOverview() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/", replace: true });
    setTimeout(() => {
      const el = document.getElementById("section-overview");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [navigate]);
  return null;
}
