import { useEffect, useState } from "react";
import { startOrchestrator, runScenario } from "@/lib/api";

const BRAND_MARK = "/faraway-logo.png";

export const NAV_SECTIONS = [
  { id: "section-hero", label: "Mission Hub", icon: "home" },
  { id: "section-invariant", label: "Master Invariant", icon: "functions" },
  { id: "section-recovery", label: "Recovery FDIR", icon: "published_with_changes" },
  { id: "section-overview", label: "Overview", icon: "dashboard" },
  { id: "section-perception", label: "Perception", icon: "visibility" },
  { id: "section-cognition", label: "Cognition", icon: "psychology" },
  { id: "section-action", label: "Action", icon: "precision_manufacturing" },
  { id: "section-orchestrator", label: "Orchestrator", icon: "settings_input_component" },
  { id: "section-audit", label: "Audit Log", icon: "history_edu" },
  { id: "section-simulation", label: "Simulation", icon: "biotech" },
] as const;

export function SideNav() {
  const [activeSection, setActiveSection] = useState<string>("section-hero");
  const [initiating, setInitiating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const dashboardEl = document.getElementById("section-dashboard");
      if (dashboardEl) {
        const dashboardTop = dashboardEl.offsetTop;
        setVisible(window.scrollY >= dashboardTop - 250);
      } else {
        setVisible(window.scrollY > 400);
      }

      const scrollPosition = window.scrollY + 120;
      for (let i = NAV_SECTIONS.length - 1; i >= 0; i--) {
        const sec = NAV_SECTIONS[i];
        const el = document.getElementById(sec.id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(sec.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveSection(id);
    }
  };

  const handleInitiateProtocol = async () => {
    setInitiating(true);
    try {
      await startOrchestrator();
      await runScenario("nominal", 5.0);
      scrollToSection("section-overview");
    } catch (e) {
      console.error(e);
      scrollToSection("section-overview");
    } finally {
      setInitiating(false);
    }
  };

  return (
    <nav className={`bg-paper-surface h-screen w-64 fixed left-0 top-0 border-r border-outline-variant/60 flex flex-col py-6 z-40 shadow-sm transition-all duration-300 ease-out ${
      visible ? "translate-x-0 opacity-100 pointer-events-auto" : "-translate-x-full opacity-0 pointer-events-none"
    }`}>
      {/* Brand Header */}
      <div className="px-5 mb-6 flex flex-col items-start gap-3">
        <button 
          onClick={() => scrollToSection("section-hero")}
          className="block hover:opacity-90 transition-opacity text-left cursor-pointer"
        >
          <img
            alt="FARAWAY brand mark"
            className="w-44 h-auto rounded-md shadow-sm border border-outline-variant/60 hover:scale-102 transition-transform"
            src={BRAND_MARK}
          />
        </button>
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-lacquer-red tracking-widest uppercase">
            SYMBIOSIS
          </h1>
          <p className="font-label-caps text-label-caps text-on-surface-variant font-bold tracking-wider text-xs">
            MISSION CONTROL
          </p>
        </div>
      </div>

      {/* Navigation Anchor Links */}
      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1.5 custom-scrollbar">
        {NAV_SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-label-caps uppercase transition-all duration-150 text-left cursor-pointer ${
                isActive
                  ? "text-lacquer-red font-bold bg-surface-container border-l-4 border-lacquer-red shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border-l-4 border-transparent"
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-lacquer-red" : "text-on-surface-variant"}`}>
                {sec.icon}
              </span>
              <span className="truncate">{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="px-5 mt-auto pt-4 border-t border-outline-variant/40">
        <button
          onClick={handleInitiateProtocol}
          disabled={initiating}
          className="w-full bg-lacquer-red text-white font-label-caps text-xs py-3 rounded-lg uppercase tracking-widest hover:bg-primary transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg font-bold disabled:opacity-50 active:scale-98 cursor-pointer"
        >
          {initiating ? "INITIALIZING..." : "INITIATE PROTOCOL"}
          <span className="material-symbols-outlined text-[16px]">
            {initiating ? "hourglass_empty" : "terminal"}
          </span>
        </button>
      </div>
    </nav>
  );
}
