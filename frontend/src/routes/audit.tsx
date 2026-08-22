import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/audit")({
  component: RedirectToAudit,
});

function RedirectToAudit() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/", replace: true });
    setTimeout(() => {
      const el = document.getElementById("section-audit");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [navigate]);
  return null;
}
