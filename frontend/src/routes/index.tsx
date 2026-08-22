import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { OrbitalScene } from "@/components/landing/OrbitalScene";
import { Backplate } from "@/components/landing/Backplate";
import { Reveal, RevealHeading } from "@/components/motion/Reveal";
import { TiltCard } from "@/components/motion/TiltCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SYMBIOSIS — Autonomous Spacecraft Rendezvous" },
      {
        name: "description",
        content:
          "SYMBIOSIS couples conformalized pose estimation, hyperdimensional cognition and exact statistical safety bounds into an autonomous rendezvous stack that always leaves the last word to a human.",
      },
      { property: "og:title", content: "SYMBIOSIS — Autonomous Spacecraft Rendezvous" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const AGENTS = [
  {
    kanji: "視",
    romaji: "SHI · SIGHT",
    title: "Perception",
    subtitle: "Conformalized 6-DoF Pose",
    body:
      "A ResNet-50 pose head is projected onto a 512-anchor Hopf grid. The spread across anchors — the Jensen Gain — is a calibrated, distribution-free measure of how badly the network is guessing, not a softmax pretending to be confidence.",
    metric: "512 SO(3) anchors",
  },
  {
    kanji: "知",
    romaji: "CHI · KNOWING",
    title: "Cognition",
    subtitle: "10,000-D Associative Memory",
    body:
      "Every situation is bound into a 10,000-dimensional hypervector and matched against a case library. Novelty is a cosine distance, root cause is a traversal of a causal fault graph, and a human override is learned in one shot.",
    metric: "D = 10,000",
  },
  {
    kanji: "行",
    romaji: "KOU · ACTION",
    title: "Action",
    subtitle: "Exact Safety Bounds",
    body:
      "Candidate maneuvers are propagated through a Clohessy-Wiltshire Monte-Carlo digital twin. Collision risk is reported as a Clopper-Pearson 99% exact upper bound — a number that holds without asymptotic hand-waving.",
    metric: "99% exact bound",
  },
  {
    kanji: "和",
    romaji: "WA · HARMONY",
    title: "Orchestrator",
    subtitle: "Graduated Autonomy",
    body:
      "Weighted multi-agent voting, a NASA-style FDIR flight director, and the Armstrong Protocol. When evidence degrades the vehicle climbs the autonomy ladder toward the crew instead of guessing louder.",
    metric: "4 override levels",
  },
];

const GUARANTEES = [
  {
    value: "≤ 5%",
    label: "Collision Upper Bound",
    detail:
      "Clopper-Pearson exact binomial bound over the Monte-Carlo ensemble. No maneuver commits above the flight limit without an explicit, logged human acknowledgement.",
  },
  {
    value: "95%",
    label: "Conformal Coverage",
    detail:
      "Distribution-free calibration on a held-out split. The reported error bound covers the true pose error at the stated rate, whatever the network happens to believe.",
  },
  {
    value: "SHA-256",
    label: "Tamper-Evident Ledger",
    detail:
      "Every decision — autonomous or human — is appended to a hash-chained log. Any post-hoc edit, delete or insert breaks the chain and is detectable on the ground.",
  },
];

function Landing() {
  const progressRef = useRef(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const span = Math.max(1, window.innerHeight * 1.6);
      progressRef.current = Math.min(1, window.scrollY / span);
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-paper-surface text-ink-charcoal font-body-md selection:bg-lacquer-red selection:text-white overflow-x-hidden">
      {/* Photographic backplate — carries its own scrim for type contrast */}
      <Backplate />

      {/* The moving bodies composite over the plate */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <OrbitalScene scrollProgressRef={progressRef} className="w-full h-full" />
      </div>

      {/* Paper grain, kept faint so it reads as tooth rather than a grid */}
      <div className="fixed inset-0 z-[2] pointer-events-none grid-bg opacity-[0.18]" />

      {/* Slim top bar */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-500 ${
          scrolled
            ? "bg-paper-surface/90 backdrop-blur-md border-b border-outline-variant/60 py-3"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-headline-md font-bold text-lacquer-red tracking-[0.28em] uppercase text-sm">
              SYMBIOSIS
            </span>
            <span className="font-label-caps text-[10px] tracking-[0.2em] text-on-surface-variant uppercase hidden sm:inline">
              共生 · Faraway Mission Systems
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/mission"
              className="font-label-caps text-[11px] uppercase tracking-widest px-4 py-2 rounded-lg border border-outline-variant text-ink-charcoal hover:bg-surface-container transition-colors"
            >
              Mission Control
            </Link>
            <Link
              to="/armstrong/pathway"
              className="font-label-caps text-[11px] uppercase tracking-widest px-4 py-2 rounded-lg bg-lacquer-red text-white hover:bg-primary transition-colors shadow-sm"
            >
              Armstrong Console
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── HERO ───────────────────────────────────────────────── */}
        <section className="min-h-screen flex flex-col justify-center px-6">
          <div className="max-w-[1200px] mx-auto w-full pt-24">
            <Reveal from="left" distance={40}>
              <div className="inline-flex items-center gap-2.5 mb-8 px-3 py-1.5 rounded-full bg-paper-surface/80 backdrop-blur border border-lacquer-red/30">
                <span className="w-2 h-2 rounded-full bg-lacquer-red animate-pulse" />
                <span className="font-label-caps text-[10px] tracking-[0.22em] text-lacquer-red font-bold uppercase">
                  Autonomous Rendezvous Program · Alpha-7
                </span>
              </div>
            </Reveal>

            <div className="flex items-start gap-8">
              {/* Vertical Japanese rule */}
              <Reveal from="down" delay={200} className="hidden lg:block shrink-0 pt-2">
                <div
                  className="font-headline-md text-lacquer-red/70 text-2xl tracking-[0.5em] leading-none"
                  style={{ writingMode: "vertical-rl" }}
                >
                  共生軌道
                </div>
              </Reveal>

              <div className="flex-1 min-w-0">
                <RevealHeading
                  text="Autonomy that knows"
                  as="h1"
                  className="font-headline-lg text-[13vw] sm:text-[9vw] lg:text-[86px] leading-[0.95] font-bold tracking-tight text-ink-charcoal"
                />
                <RevealHeading
                  text="when to ask."
                  as="h1"
                  wordDelay={70}
                  className="font-headline-lg text-[13vw] sm:text-[9vw] lg:text-[86px] leading-[0.95] font-bold tracking-tight text-lacquer-red mb-8"
                />

                <Reveal from="up" delay={480}>
                  <p className="font-body-md text-base md:text-lg leading-relaxed max-w-2xl text-ink-charcoal/85 mb-3">
                    A spacecraft closing on a tumbling target has no time to wait for the ground.
                    SYMBIOSIS lets it decide — and hands control back the moment its own evidence
                    stops being trustworthy.
                  </p>
                  <p className="font-mono text-xs text-on-surface-variant max-w-2xl mb-10 leading-relaxed">
                    Conformalized pose uncertainty · hyperdimensional causal reasoning ·
                    Clopper-Pearson exact safety bounds · a tamper-evident record of every call made.
                  </p>
                </Reveal>

                <Reveal from="up" delay={620}>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/mission"
                      className="group inline-flex items-center gap-2.5 bg-lacquer-red text-white font-label-caps text-xs uppercase tracking-[0.18em] px-7 py-4 rounded-xl hover:bg-primary transition-all shadow-lg hover:shadow-xl active:scale-[0.98] font-bold"
                    >
                      Enter Mission Control
                      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                        arrow_forward
                      </span>
                    </Link>
                    <a
                      href="#architecture"
                      className="inline-flex items-center gap-2.5 bg-paper-surface/85 backdrop-blur border border-outline-variant text-ink-charcoal font-label-caps text-xs uppercase tracking-[0.18em] px-7 py-4 rounded-xl hover:bg-surface-container transition-all font-bold"
                    >
                      How it works
                      <span className="material-symbols-outlined text-[18px]">expand_more</span>
                    </a>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>

          <Reveal from="up" delay={900} className="absolute bottom-8 inset-x-0">
            <div className="flex flex-col items-center gap-2 text-on-surface-variant">
              <span className="font-label-caps text-[10px] uppercase tracking-[0.3em]">Scroll</span>
              <span className="w-[1px] h-10 bg-gradient-to-b from-outline-variant to-transparent" />
            </div>
          </Reveal>
        </section>

        {/* ── THE PROBLEM ────────────────────────────────────────── */}
        <section className="px-6 py-32">
          <div className="max-w-[1000px] mx-auto">
            <Reveal from="left">
              <span className="font-label-caps text-[10px] uppercase tracking-[0.3em] text-lacquer-red font-bold">
                01 — The Constraint
              </span>
            </Reveal>
            <RevealHeading
              text="Light is too slow to fly a docking."
              as="h2"
              className="font-headline-lg text-[34px] md:text-[52px] leading-[1.08] font-bold tracking-tight text-ink-charcoal mt-4 mb-8"
            />
            <div className="grid md:grid-cols-2 gap-10">
              <Reveal from="up" delay={120}>
                <p className="text-base leading-relaxed text-ink-charcoal/85">
                  At Mars distance a round trip to mission control costs up to 44 minutes. A
                  rendezvous decision costs seconds. The vehicle either acts on its own reading of
                  the world, or it does not act at all.
                </p>
              </Reveal>
              <Reveal from="up" delay={240}>
                <p className="text-base leading-relaxed text-ink-charcoal/85">
                  So the interesting question is not whether the autonomy is confident. It is
                  whether that confidence is <em>calibrated</em> — and what the vehicle does in the
                  moment it discovers it is not.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── THE FOUR AGENTS ────────────────────────────────────── */}
        <section id="architecture" className="px-6 py-24 scroll-mt-24">
          <div className="max-w-[1200px] mx-auto">
            <Reveal from="left">
              <span className="font-label-caps text-[10px] uppercase tracking-[0.3em] text-lacquer-red font-bold">
                02 — The Architecture
              </span>
            </Reveal>
            <RevealHeading
              text="Four agents. One shared conscience."
              as="h2"
              className="font-headline-lg text-[34px] md:text-[52px] leading-[1.08] font-bold tracking-tight text-ink-charcoal mt-4 mb-14"
            />

            <div className="grid sm:grid-cols-2 gap-6">
              {AGENTS.map((agent, i) => (
                <Reveal key={agent.title} from={i % 2 === 0 ? "left" : "right"} delay={i * 90}>
                  <TiltCard
                    maxTilt={6}
                    lift={14}
                    className="h-full rounded-2xl bg-paper-surface/92 backdrop-blur-sm border border-outline-variant/80 p-8"
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className="font-label-caps text-[10px] uppercase tracking-[0.24em] text-on-surface-variant mb-2">
                          {agent.romaji}
                        </div>
                        <h3 className="font-headline-md text-[26px] font-bold text-ink-charcoal leading-none">
                          {agent.title}
                        </h3>
                        <div className="font-mono text-xs text-lacquer-red mt-1.5">
                          {agent.subtitle}
                        </div>
                      </div>
                      <span className="font-headline-lg text-[52px] leading-none text-lacquer-red/15 select-none">
                        {agent.kanji}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-charcoal/80 mb-5">{agent.body}</p>
                    <div className="pt-4 border-t border-outline-variant/50 font-mono text-xs font-bold text-moss-accent">
                      {agent.metric}
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── GUARANTEES ─────────────────────────────────────────── */}
        <section className="px-6 py-24">
          <div className="max-w-[1200px] mx-auto">
            <Reveal from="left">
              <span className="font-label-caps text-[10px] uppercase tracking-[0.3em] text-lacquer-red font-bold">
                03 — What Is Actually Guaranteed
              </span>
            </Reveal>
            <RevealHeading
              text="Numbers that hold, not numbers that impress."
              as="h2"
              className="font-headline-lg text-[34px] md:text-[52px] leading-[1.08] font-bold tracking-tight text-ink-charcoal mt-4 mb-14"
            />
            <div className="grid md:grid-cols-3 gap-6">
              {GUARANTEES.map((g, i) => (
                <Reveal key={g.label} from="up" delay={i * 130}>
                  <TiltCard
                    maxTilt={5}
                    lift={10}
                    glare={false}
                    className="h-full rounded-2xl bg-paper-surface/92 backdrop-blur-sm border border-outline-variant/80 p-8"
                  >
                    <div className="font-headline-lg text-[46px] leading-none font-bold text-lacquer-red mb-3 font-mono tracking-tight">
                      {g.value}
                    </div>
                    <div className="font-label-caps text-[11px] uppercase tracking-[0.16em] font-bold text-ink-charcoal mb-3">
                      {g.label}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-charcoal/75">{g.detail}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── ARMSTRONG ──────────────────────────────────────────── */}
        <section className="px-6 py-24">
          <div className="max-w-[1200px] mx-auto">
            <Reveal from="scale">
              <div className="relative rounded-3xl border border-lacquer-red/25 bg-paper-surface/94 backdrop-blur-md p-10 md:p-16 overflow-hidden">
                <div
                  className="absolute -right-10 -top-10 font-headline-lg text-[200px] leading-none text-lacquer-red/[0.05] select-none pointer-events-none"
                  aria-hidden
                >
                  人
                </div>
                <div className="relative">
                  <span className="font-label-caps text-[10px] uppercase tracking-[0.3em] text-lacquer-red font-bold">
                    04 — The Last Word
                  </span>
                  <RevealHeading
                    text="The Armstrong Protocol"
                    as="h2"
                    className="font-headline-lg text-[34px] md:text-[52px] leading-[1.08] font-bold tracking-tight text-ink-charcoal mt-4 mb-6"
                  />
                  <p className="text-base leading-relaxed text-ink-charcoal/85 max-w-3xl mb-4">
                    Named for the manual takeover of the Apollo 11 landing computer. When the
                    evidence degrades past its calibrated threshold, the vehicle stops, states what
                    it is unsure about in plain language, and offers the operator every recovery
                    pathway its flight director can actually justify.
                  </p>
                  <p className="text-base leading-relaxed text-ink-charcoal/85 max-w-3xl mb-8">
                    The operator picks a pathway, tunes its real physical parameters, and watches the
                    predicted uncertainty, delta-V and collision bound recompute as they type. Nothing commits without a written rationale, and the rationale is chained
                    into the ledger alongside the decision.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to="/armstrong/pathway"
                      className="group inline-flex items-center gap-2.5 bg-lacquer-red text-white font-label-caps text-xs uppercase tracking-[0.18em] px-7 py-4 rounded-xl hover:bg-primary transition-all shadow-lg active:scale-[0.98] font-bold"
                    >
                      Open the Console
                      <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                        arrow_forward
                      </span>
                    </Link>
                    <Link
                      to="/mission"
                      className="inline-flex items-center gap-2.5 border border-outline-variant text-ink-charcoal font-label-caps text-xs uppercase tracking-[0.18em] px-7 py-4 rounded-xl hover:bg-surface-container transition-all font-bold"
                    >
                      See Live Telemetry
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <footer className="px-6 py-16 border-t border-outline-variant/50">
          <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div>
              <div className="font-headline-md font-bold text-lacquer-red tracking-[0.28em] uppercase text-sm">
                SYMBIOSIS
              </div>
              <p className="font-mono text-[11px] text-on-surface-variant mt-1">
                Autonomous Spacecraft Proximity Operations · Faraway Mission Systems
              </p>
            </div>
            <p className="font-mono text-[11px] text-on-surface-variant/70 max-w-md">
              All telemetry rendered on this site is produced by the running simulation stack. No
              value on any screen is a placeholder.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
