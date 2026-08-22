import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/cognition")({
  component: RedirectToCognition,
});

function RedirectToCognition() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/mission", replace: true });
    setTimeout(() => {
      const el = document.getElementById("section-cognition");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [navigate]);
  return null;
}
