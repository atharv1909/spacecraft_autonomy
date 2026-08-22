import React, { useEffect, useState } from 'react';
import SakuraScene from './SakuraScene';
import './LandingHero.css';

interface LandingHeroProps {
  onExploreClick?: () => void;
  onLaunchClick?: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onExploreClick, onLaunchClick }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReady(true);
      return;
    }
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleLaunch = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onLaunchClick) {
      onLaunchClick();
    } else {
      const el = document.getElementById('section-overview');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleExplore = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onExploreClick) {
      onExploreClick();
    } else {
      const el = document.getElementById('story');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="landing-hero" id="top">
      <div className="landing-hero__media" aria-hidden="true">
        <div className={`landing-hero__scene ${ready ? 'is-ready' : ''}`}>
          <SakuraScene />
        </div>
        <div className="landing-hero__scrim" />
      </div>

      <div className="landing-hero__body">
        <div className="landing-hero__badge">
          <span className="w-2 h-2 rounded-full bg-[#f7b8cb] animate-pulse"></span>
          <span className="landing-hero__badge-text">
            Autonomous Spacecraft Rendezvous and Safety Consensus
          </span>
        </div>

        <h1 className="landing-hero__title">
          AI That Knows When It's Wrong
          <br />
          Before It Acts.
        </h1>

        <p className="landing-hero__subtitle">
          At 28,000 kilometers per hour, standard neural networks cannot afford a single hallucination. SYMBIOSIS gives autonomous spacecraft the mathematical self awareness to detect optical illusions, verify orbital physics, and prevent catastrophic collisions without waiting for ground control.
        </p>

        <div className="landing-hero__actions">
          <button className="btn-sakura-pearl" onClick={handleLaunch}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Launch Mission Control
          </button>
          
          <button className="btn-sakura-glass" onClick={handleExplore}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 16 16 12 12 8"></polyline>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Why This Matters
          </button>
        </div>
      </div>
    </section>
  );
};
export default LandingHero;
