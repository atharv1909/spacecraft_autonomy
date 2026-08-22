import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SideNav } from "@/components/SideNav";
import { SakuraShader } from "@/components/SakuraShader";
import { SystemHealthHeader } from "@/components/SystemHealthHeader";
import { SectionDivider } from "@/components/SectionDivider";
import { Reveal, RevealHeading } from "@/components/motion/Reveal";
import { OverviewSection } from "@/components/sections/OverviewSection";
import { PerceptionSection } from "@/components/sections/PerceptionSection";
import { CognitionSection } from "@/components/sections/CognitionSection";
import { ActionSection } from "@/components/sections/ActionSection";
import { OrchestratorSection } from "@/components/sections/OrchestratorSection";
import { AuditSection } from "@/components/sections/AuditSection";
import { SimulationSection } from "@/components/sections/SimulationSection";
import { OverrideHistorySection } from "@/components/sections/OverrideHistorySection";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "Mission Control Dashboard — SYMBIOSIS" },
      {
        name: "description",
        content:
          "Unified mission control for the SYMBIOSIS autonomous rendezvous program: perception, cognition, action, orchestration, audit, and simulation.",
      },
      { property: "og:title", content: "Mission Control Dashboard — SYMBIOSIS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UnifiedDashboard,
});

const SECTIONS = [
  {
    id: "section-perception",
    icon: "photo_camera",
    title: "1. Optical Input & Pose Estimation",
    subtitle:
      "Submit a frame. Everything downstream — pose, uncertainty, safety bounds — is derived from what the camera sees",
    badge: "Frame Input",
    Body: PerceptionSection,
  },
  {
    id: "section-overview",
    icon: "dashboard",
    title: "2. System Overview & Telemetry",
    subtitle:
      "Relative state in the CWH frame, approach-corridor geometry, and the live evidence channels",
    badge: "Derived State",
    Body: OverviewSection,
  },
  {
    id: "section-cognition",
    icon: "psychology",
    title: "3. Hyperdimensional Cognition & Causal Inference",
    subtitle: "10,000-D situation vector associative memory and root-cause fault graph traversal",
    badge: "HDC Engine",
    Body: CognitionSection,
  },
  {
    id: "section-action",
    icon: "precision_manufacturing",
    title: "4. Action Selection & Physics Digital Twin",
    subtitle:
      "Clopper-Pearson 99% exact collision bounds and the RPO flight corridor they were evaluated inside",
    badge: "CWH Dynamics",
    Body: ActionSection,
  },
  {
    id: "section-orchestrator",
    icon: "settings_input_component",
    title: "5. Autonomy Consensus & Armstrong Protocol",
    subtitle:
      "Multi-agent voting matrix, Graduated Autonomy Ladder, NASA FDIR flight director, and human overrides",
    badge: "FDIR Matrix",
    Body: OrchestratorSection,
  },
  {
    id: "section-overrides",
    icon: "how_to_reg",
    title: "6. Committed Human Overrides",
    subtitle:
      "Every Armstrong Console commit, with the operator's own parameters and written rationale as chained into the ledger",
    badge: "Human In The Loop",
    Body: OverrideHistorySection,
  },
  {
    id: "section-audit",
    icon: "history_edu",
    title: "7. Tamper-Evident Audit Ledger",
    subtitle: "SHA-256 cryptographic hash-chained decision records with independent ground verification",
    badge: "SHA-256 Chain",
    Body: AuditSection,
  },
  {
    id: "section-simulation",
    icon: "biotech",
    title: "8. Orbital Simulation & Stress Testbed",
    subtitle:
      "Synthetic rendezvous scenarios across nominal approach, thermal failure cascade, perception glare, and multi-failure",
    badge: "Digital Twin",
    Body: SimulationSection,
  },
] as const;

function UnifiedDashboard() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const checkScroll = () => setShowBackToTop(window.scrollY > 400);
    checkScroll();
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="font-body-md antialiased overflow-x-hidden min-h-screen relative bg-paper-surface selection:bg-lacquer-red selection:text-white">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-700"
        style={{
          backgroundImage: "url('/sakura-bg.jpg')",
          opacity: 0.35,
          filter: "saturate(1.15) contrast(1.05)",
        }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-paper-surface/70 via-paper-surface/50 to-paper-surface/90" />

      <SideNav />
      <SakuraShader />

      <div className="md:ml-64 relative z-10 min-h-screen flex flex-col">
        <SystemHealthHeader title="SYMBIOSIS Unified Mission Control" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto flex flex-col gap-10">
          {/* ── HERO ─────────────────────────────────────────────── */}
          <section id="section-hero" className="flex flex-col items-center justify-center pt-6 pb-4">
            <Reveal from="scale" className="w-full">
              <div className="bg-paper-surface/92 backdrop-blur-md border border-outline-variant/80 rounded-2xl p-6 md:p-10 shadow-xl w-full relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
                  <div className="flex-1 text-center md:text-left">
                    <Reveal from="left" delay={80}>
                      <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-lacquer-red/10 border border-lacquer-red/30">
                        <span className="w-2 h-2 rounded-full bg-lacquer-red animate-pulse" />
                        <span className="font-label-caps text-xs text-lacquer-red font-bold uppercase tracking-wider">
                          SYMBIOSIS AUTONOMOUS RENDEZVOUS PROGRAM
                        </span>
                      </div>
                    </Reveal>

                    <RevealHeading
                      text="Mission Control Center"
                      as="h1"
                      className="font-headline-lg text-headline-lg md:text-[44px] md:leading-[52px] text-ink-charcoal uppercase tracking-tight mb-3 font-bold"
                    />

                    <Reveal from="up" delay={260}>
                      <p className="font-body-md text-ink-charcoal/90 text-sm md:text-base leading-relaxed mb-6 max-w-2xl">
                        A multi-agent autonomous framework coupling{" "}
                        <strong>Hyperdimensional Cognition</strong>,{" "}
                        <strong>Conformalized Pose Estimation</strong>, and{" "}
                        <strong>Clopper-Pearson Exact Safety Guarantees</strong> into a unified
                        real-time operations environment.
                      </p>
                    </Reveal>

                    <Reveal from="up" delay={360}>
                      <div className="flex flex-wrap gap-2.5 justify-center md:justify-start">
                        <Link
                          to="/armstrong/pathway"
                          className="bg-lacquer-red text-white text-xs font-label-caps px-4 py-2.5 rounded-lg hover:bg-primary transition-all shadow hover:shadow-md flex items-center gap-1.5 font-bold uppercase tracking-wider"
                        >
                          <span className="material-symbols-outlined text-[16px]">shield_with_heart</span>
                          Armstrong Console
                        </Link>
                        {(
                          [
                            ["section-perception", "photo_camera", "Upload a Frame"],
                            ["section-overview", "dashboard", "Live Telemetry"],
                            ["section-orchestrator", "settings_input_component", "Orchestrator"],
                            ["section-overrides", "how_to_reg", "Override Log"],
                          ] as const
                        ).map(([id, icon, label]) => (
                          <button
                            key={id}
                            onClick={() => scrollTo(id)}
                            className="bg-surface-container text-ink-charcoal text-xs font-label-caps px-4 py-2.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">{icon}</span>
                            {label}
                          </button>
                        ))}
                      </div>
                    </Reveal>
                  </div>

                  <Reveal from="right" delay={220} className="shrink-0 text-center">
                    <div className="relative inline-block">
                      <img
                        alt="FARAWAY Brand Mark Hero"
                        className="w-48 md:w-56 h-auto mx-auto rounded-lg shadow-lg border border-outline-variant/80 mb-2"
                        src="/faraway-logo.png"
                      />
                      <div className="stamp font-label-caps text-label-caps bg-lacquer-red text-white px-2 py-0.5 rounded shadow-sm font-bold text-[10px] absolute -bottom-2 right-2">
                        ALPHA-7 VERIFIED
                      </div>
                    </div>
                  </Reveal>
                </div>
              </div>
            </Reveal>
          </section>

          {SECTIONS.map(({ id, icon, title, subtitle, badge, Body }) => (
            <section key={id} id={id}>
              <Reveal from="left">
                <SectionDivider icon={icon} title={title} subtitle={subtitle} badge={badge} />
              </Reveal>
              <Reveal from="up" delay={90}>
                <Body />
              </Reveal>
            </section>
          ))}

          <footer className="mt-12 py-8 border-t border-outline-variant/60 text-center flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-headline-md font-bold text-lacquer-red text-sm tracking-wider uppercase">
                SYMBIOSIS
              </span>
              <span className="text-on-surface-variant text-xs font-mono">
                • Autonomous Spacecraft Proximity Operations
              </span>
            </div>
            <p className="text-xs font-mono text-on-surface-variant max-w-xl">
              Equipped with Conformalized Confidence Guarantees, Clohessy-Wiltshire Dynamics,
              Hyperdimensional Causal Traversal, and SHA-256 Append-Only Decision Logging.
            </p>
            <Link
              to="/"
              className="text-[11px] font-mono text-on-surface-variant/70 hover:text-lacquer-red transition-colors"
            >
              ← Back to programme overview
            </Link>
          </footer>
        </main>
      </div>

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 bg-lacquer-red text-white p-3 rounded-full shadow-xl hover:bg-primary transition-all flex items-center justify-center cursor-pointer active:scale-95"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
        </button>
      )}
    </div>
  );
}
