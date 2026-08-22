import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/perception")({
  component: RedirectToPerception,
});

function RedirectToPerception() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/mission", replace: true });
    setTimeout(() => {
      const el = document.getElementById("section-perception");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [navigate]);
  return null;
}
