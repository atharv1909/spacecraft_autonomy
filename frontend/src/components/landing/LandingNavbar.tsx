import React, { useState } from 'react';
import './LandingNavbar.css';

const NAV_LINKS = [
  { label: 'The Problem', id: 'story' },
  { label: 'Architecture', id: 'section-overview' },
  { label: 'Perception', id: 'section-perception' },
  { label: 'Cognition', id: 'section-cognition' },
  { label: 'Action Engine', id: 'section-action' },
  { label: 'Consensus and FDIR', id: 'section-orchestrator' },
];

export const LandingNavbar: React.FC = () => {
  const [active, setActive] = useState('The Problem');

  const scrollTo = (id: string, label: string) => {
    setActive(label);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLaunch = () => {
    const el = document.getElementById('section-overview');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="landing-nav">
      <div className="landing-nav__inner">
        <a className="landing-nav__brand" href="#top">
          <img 
            src="/faraway-logo.png" 
            alt="FARAWAY" 
            className="landing-nav__brand-img"
          />
          <span>SYMBIOSIS</span>
        </a>

        <nav className="landing-nav__rail" aria-label="Primary">
          {NAV_LINKS.map(({ label, id }) => (
            <button
              key={label}
              className={`landing-nav__link ${active === label ? 'is-active' : ''}`}
              onClick={() => scrollTo(id, label)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="landing-nav__actions">
          <button className="landing-btn--ink" onClick={handleLaunch}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block mr-1.5"></span>
            Mission Control Center
          </button>
        </div>
      </div>
    </header>
  );
};
export default LandingNavbar;
