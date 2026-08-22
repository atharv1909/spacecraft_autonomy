import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SideNav } from "@/components/SideNav";
import { SakuraShader } from "@/components/SakuraShader";
import { SystemHealthHeader } from "@/components/SystemHealthHeader";
import { SectionDivider } from "@/components/SectionDivider";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingStory } from "@/components/landing/LandingStory";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { UnifiedInvariantSection } from "@/components/sections/UnifiedInvariantSection";
import { RecoveryWorkflowSection } from "@/components/sections/RecoveryWorkflowSection";
import { OverviewSection } from "@/components/sections/OverviewSection";
import { PerceptionSection } from "@/components/sections/PerceptionSection";
import { CognitionSection } from "@/components/sections/CognitionSection";
import { ActionSection } from "@/components/sections/ActionSection";
import { OrchestratorSection } from "@/components/sections/OrchestratorSection";
import { AuditSection } from "@/components/sections/AuditSection";
import { SimulationSection } from "@/components/sections/SimulationSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mission Control Dashboard — SYMBIOSIS" },
      { name: "description", content: "Unified mission control for the SYMBIOSIS autonomous rendezvous program: perception, cognition, action, orchestration, audit, and simulation." },
      { property: "og:title", content: "Mission Control Dashboard — SYMBIOSIS" },
      { property: "og:description", content: "Unified mission control for the SYMBIOSIS autonomous rendezvous program: perception, cognition, action, orchestration, audit, and simulation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UnifiedDashboard,
});

function UnifiedDashboard() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (window.scrollY > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="font-body-md antialiased overflow-x-hidden min-h-screen relative bg-transparent selection:bg-lacquer-red selection:text-white">
      {/* Full-Page Background Cherry Blossom Image */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: "url('/sakura-bg.jpg')",
          opacity: 0.50,
          filter: "saturate(1.25) contrast(1.05)"
        }}
      />
      
      {/* Gentle Atmospheric Cream Wash */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-paper-surface/40 via-paper-surface/25 to-paper-surface/65" />

      {/* Sidebar Navigation */}
      <SideNav />
      <SakuraShader />

      {/* Landing Page Hero Header & Animated Sakura Scene */}
      <div id="top" className="relative z-20">
        <LandingNavbar />
        <LandingHero 
          onLaunchClick={() => scrollTo("section-overview")}
          onExploreClick={() => scrollTo("story")}
        />
        <LandingStory 
          onLaunchClick={() => scrollTo("section-overview")}
        />
      </div>

      {/* Main Content Area */}
      <div id="section-dashboard" className="md:ml-64 relative z-10 min-h-screen flex flex-col">
        {/* Sticky Global Mission Control Header */}
        <SystemHealthHeader title="SYMBIOSIS Unified Mission Control" />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto flex flex-col gap-10">
          
          {/* ========================================================
              HERO / MISSION ARCHITECTURE INTRO
             ======================================================== */}
          <section id="section-hero" className="flex flex-col items-center justify-center pt-6 pb-4">
            <div className="bg-paper-surface/92 backdrop-blur-md border border-outline-variant/80 rounded-2xl p-6 md:p-10 shadow-xl w-full relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
                
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-lacquer-red/10 border border-lacquer-red/30">
                    <span className="w-2 h-2 rounded-full bg-lacquer-red animate-pulse"></span>
                    <span className="font-label-caps text-xs text-lacquer-red font-bold uppercase tracking-wider">
                      SYMBIOSIS AUTONOMOUS RENDEZVOUS PROGRAM
                    </span>
                  </div>

                  <h1 className="font-headline-lg text-headline-lg md:text-[44px] md:leading-[52px] text-ink-charcoal uppercase tracking-tight mb-3 font-bold">
                    Mission Control Center
                  </h1>

                  <p className="font-body-md text-ink-charcoal/90 text-sm md:text-base leading-relaxed mb-6 max-w-2xl">
                    A multi-agent autonomous framework coupling <strong>Hyperdimensional Cognition</strong>, <strong>Conformalized Pose Estimation</strong>, and <strong>Clopper-Pearson Exact Safety Guarantees</strong> into a unified real-time operations environment.
                  </p>

                  {/* Quick Jump Buttons */}
                  <div className="flex flex-wrap gap-2.5 justify-center md:justify-start">
                    <button 
                      onClick={() => scrollTo("section-invariant")} 
                      className="bg-lacquer-red text-white text-xs font-label-caps px-4 py-2.5 rounded-lg hover:bg-primary transition-all shadow hover:shadow-md flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">functions</span>
                      Master Invariant
                    </button>
                    <button 
                      onClick={() => scrollTo("section-recovery")} 
                      className="bg-surface-container text-ink-charcoal text-xs font-label-caps px-4 py-2.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">published_with_changes</span>
                      Recovery Workflow
                    </button>
                    <button 
                      onClick={() => scrollTo("section-overview")} 
                      className="bg-surface-container text-ink-charcoal text-xs font-label-caps px-4 py-2.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">dashboard</span>
                      Live Telemetry
                    </button>
                    <button 
                      onClick={() => scrollTo("section-perception")} 
                      className="bg-surface-container text-ink-charcoal text-xs font-label-caps px-4 py-2.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      Perception Feed
                    </button>
                    <button 
                      onClick={() => scrollTo("section-orchestrator")} 
                      className="bg-surface-container text-ink-charcoal text-xs font-label-caps px-4 py-2.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">settings_input_component</span>
                      Orchestrator
                    </button>
                    <button 
                      onClick={() => scrollTo("section-simulation")} 
                      className="bg-surface-container text-ink-charcoal text-xs font-label-caps px-4 py-2.5 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">biotech</span>
                      Testbed Runs
                    </button>
                  </div>
                </div>

                {/* Brand Badge */}
                <div className="shrink-0 text-center">
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
                </div>

              </div>
            </div>
          </section>

          {/* ========================================================
              SECTION 0: UNIFIED AEROSPACE MASTER INVARIANT (U-HCAM)
             ======================================================== */}
          <section id="section-invariant">
            <SectionDivider 
              icon="functions"
              title="Unified Aerospace Master Invariant (U-HCAM Engine)"
              subtitle="Hamilton-Jacobi-Bellman reachability, Fisher-Riemannian Quotient Manifold geometry SO(3)/G_sym, and Conformalized Chi-Square flight innovation gating"
              badge="Master Invariant"
            />
            <UnifiedInvariantSection />
          </section>

          {/* ========================================================
              SECTION 0.5: RECOVERABLE ERROR PATH & FDIR WORKFLOW
             ======================================================== */}
          <section id="section-recovery">
            <SectionDivider 
              icon="published_with_changes"
              title="Autonomous Fault Recovery (FDIR Workflow)"
              subtitle="Replacing generic abort errors with multi-stage deterministic recovery ladders, interactive Recharts telemetry verification, and real-time state re-convergence"
              badge="Active Recovery"
            />
            <RecoveryWorkflowSection />
          </section>

          {/* ========================================================
              SECTION 1: SYSTEM OVERVIEW & PROXIMITY TELEMETRY
             ======================================================== */}
          <section id="section-overview">
            <SectionDivider 
              icon="dashboard"
              title="1. System Overview & Telemetry"
              subtitle="Live CWH frame trajectory propagation, safety channel status, and 12-thruster allocation matrix"
              badge="Live Bus"
            />
            <OverviewSection />
          </section>

          {/* ========================================================
              SECTION 2: PERCEPTION & VISION STACK
             ======================================================== */}
          <section id="section-perception">
            <SectionDivider 
              icon="visibility"
              title="2. Perception & Vision Pipeline"
              subtitle="ResNet-50 6-DoF neural pose estimation, calibrated Jensen Gain uncertainty, and Stanford SPEED+ benchmark"
              badge="Sensor Fusion"
            />
            <PerceptionSection />
          </section>

          {/* ========================================================
              SECTION 3: COGNITION & CAUSAL REASONING
             ======================================================== */}
          <section id="section-cognition">
            <SectionDivider 
              icon="psychology"
              title="3. Hyperdimensional Cognition & Causal Inference"
              subtitle="10,000-D situation vector associative memory and root-cause fault graph traversal"
              badge="HDC Engine"
            />
            <CognitionSection />
          </section>

          {/* ========================================================
              SECTION 4: ACTION & TRAJECTORY SELECTION
             ======================================================== */}
          <section id="section-action">
            <SectionDivider 
              icon="precision_manufacturing"
              title="4. Action Selection & Collision Probability"
              subtitle="Clopper-Pearson 99% exact statistical safety upper bounds and 100-rollout Monte-Carlo digital twin"
              badge="Exact Bounds"
            />
            <ActionSection />
          </section>

          {/* ========================================================
              SECTION 5: AUTONOMY ORCHESTRATOR & ARBITRATION
             ======================================================== */}
          <section id="section-orchestrator">
            <SectionDivider 
              icon="settings_input_component"
              title="5. Autonomy Consensus & Policy Arbitration"
              subtitle="Multi-agent voting matrix, Graduated Autonomy Ladder, NASA FDIR flight director, and Armstrong overrides"
              badge="FDIR Matrix"
            />
            <OrchestratorSection />
          </section>

          {/* ========================================================
              SECTION 6: CRYPTOGRAPHIC AUDIT LOG
             ======================================================== */}
          <section id="section-audit">
            <SectionDivider 
              icon="history_edu"
              title="6. Tamper-Evident Audit Ledger"
              subtitle="SHA-256 cryptographic hash-chained decision records with independent ground verification"
              badge="SHA-256 Chain"
            />
            <AuditSection />
          </section>

          {/* ========================================================
              SECTION 7: ORBITAL SIMULATION TESTBED
             ======================================================== */}
          <section id="section-simulation">
            <SectionDivider 
              icon="biotech"
              title="7. Orbital Simulation & Stress Testbed"
              subtitle="Synthetic rendezvous scenarios across nominal approach, thermal failure cascade, perception glare, and multi-failure"
              badge="Digital Twin"
            />
            <SimulationSection />
          </section>

          {/* ========================================================
              FOOTER
             ======================================================== */}
          <footer className="mt-12 py-8 border-t border-outline-variant/60 text-center flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-headline-md font-bold text-lacquer-red text-sm tracking-wider uppercase">SYMBIOSIS</span>
              <span className="text-on-surface-variant text-xs font-mono">• Autonomous Spacecraft Proximity Operations</span>
            </div>
            <p className="text-xs font-mono text-on-surface-variant max-w-xl">
              Equipped with Conformalized Confidence Guarantees, Clohessy-Wiltshire Dynamics, Hyperdimensional Causal Traversal, and SHA-256 Append-Only Decision Logging.
            </p>
            <div className="text-[11px] font-mono text-on-surface-variant/60">
              © Faraway Mission Systems — All telemetry channels live & verified.
            </div>
          </footer>

        </main>
      </div>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-lacquer-red text-white p-3 rounded-full shadow-xl hover:bg-primary transition-all flex items-center justify-center cursor-pointer active:scale-95 animate-fade-in"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
        </button>
      )}
    </div>
  );
}
