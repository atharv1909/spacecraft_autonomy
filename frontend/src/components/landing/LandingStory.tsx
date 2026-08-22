import React from 'react';
import './LandingHero.css';

interface LandingStoryProps {
  onLaunchClick?: () => void;
}

export const LandingStory: React.FC<LandingStoryProps> = ({ onLaunchClick }) => {
  return (
    <section className="landing-narrative-section" id="story">
      <div className="landing-container">
        
        <div className="landing-section-header">
          <span className="landing-section-tag">The Physics of Space Autonomy</span>
          <h2 className="landing-section-title">
            Why Self-Driving Logic Fails in Deep Space
          </h2>
          <p className="landing-section-desc">
            Space rendezvous is the most unforgiving operational environment known to aerospace engineering. Here is why conventional autonomous driving systems cannot operate in orbit, and what makes SYMBIOSIS essential.
          </p>
        </div>

        <div className="landing-story-grid">
          
          {/* STEP 1 */}
          <article className="landing-story-card">
            <span className="landing-story-card__step">Phase 1: The Physics Problem</span>
            <h3 className="landing-story-card__title">The Self Driving Car vs The Spacecraft</h3>
            <div className="landing-story-card__body">
              <p>
                Imagine you are in a self driving car on Earth. A sudden thunderstorm hits, or bright headlights blind the forward camera. The computer gets confused, hits the brakes, and pulls over to the side of the road.
              </p>
              <p className="mt-3">
                On Earth, friction and gravity make stopping simple. In orbit, there is no friction, there are no brakes, and you are flying a multi ton vehicle at <strong>28,000 kilometers per hour</strong>.
              </p>
            </div>
            <div className="landing-story-card__highlight">
              If the computer freezes or miscalculates for two seconds, the spacecraft does not pull over. It collides at supersonic speed.
            </div>
          </article>

          {/* STEP 2 */}
          <article className="landing-story-card">
            <span className="landing-story-card__step">Phase 2: The Communication Limit</span>
            <h3 className="landing-story-card__title">Why Remote Human Control Is Physically Impossible</h3>
            <div className="landing-story-card__body">
              <p>
                Why not have an engineer in mission control fly the spacecraft with a joystick? The fundamental constraint is the speed of light.
              </p>
              <p className="mt-3">
                When humanity travels to Mars or deep space, radio signals take 14 to 20 minutes to reach Earth, and another 14 to 20 minutes to return. That is a <strong>30 to 40 minute round trip communication latency</strong>.
              </p>
            </div>
            <div className="landing-story-card__highlight">
              If a spacecraft is five meters from collision at Mars, mission control on Earth will not even receive the video until twenty minutes after impact.
            </div>
          </article>

          {/* STEP 3 */}
          <article className="landing-story-card">
            <span className="landing-story-card__step">Phase 3: The Vision Failure</span>
            <h3 className="landing-story-card__title">The Fatal Flaw of Standard Artificial Intelligence</h3>
            <div className="landing-story-card__body">
              <p>
                Standard computer vision neural networks suffer from a dangerous flaw: they do not know when they are guessing.
              </p>
              <p className="mt-3">
                In space, unfiltered sunlight is blinding, and satellites have symmetric solar arrays that appear identical whether upright or inverted. When sun glare strikes the lens, a standard model will hallucinate with high confidence and fire thrusters upside down.
              </p>
            </div>
            <div className="landing-story-card__highlight">
              A standard vision model outputs false certainty. In orbital operations, a confident mistake destroys a 500 million dollar mission.
            </div>
          </article>

          {/* STEP 4 */}
          <article className="landing-story-card">
            <span className="landing-story-card__step">Phase 4: The SYMBIOSIS Solution</span>
            <h3 className="landing-story-card__title">Mathematical Self Awareness and Tripwires</h3>
            <div className="landing-story-card__body">
              <p>
                SYMBIOSIS eliminates blind trust. Before any thruster pulse is commanded, the multi agent system evaluates three non negotiable questions:
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <strong>1. Vision Integrity Check:</strong> Is the optical sensor degraded by glare or geometric symmetry? If so, immediately hold station.
                </li>
                <li>
                  <strong>2. Orbital Dynamics Proof:</strong> Does the proposed maneuver satisfy Hill Clohessy Wiltshire orbital physics and NASA safety corridors?
                </li>
                <li>
                  <strong>3. Rigorous Safety Bound:</strong> Is the Clopper Pearson collision probability mathematically bounded below 1%?
                </li>
              </ul>
            </div>
            <div className="landing-story-card__highlight">
              If any verification fails, the Autonomy Ladder steps down and enforces a passive safety hold.
            </div>
          </article>

          {/* STEP 5 */}
          <article className="landing-story-card" style={{ gridColumn: 'span 1' }}>
            <span className="landing-story-card__step">Phase 5: Global Mission Impact</span>
            <h3 className="landing-story-card__title">The Future of Space Infrastructure</h3>
            <div className="landing-story-card__body">
              <p>
                Every major future space exploration architecture depends entirely on autonomous docking:
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <strong>NASA Artemis Program:</strong> Crew and cargo transfer at lunar orbit.
                </li>
                <li>
                  <strong>Orbital Propellant Depots:</strong> Fueling deep space transport vessels in Low Earth Orbit.
                </li>
                <li>
                  <strong>Orbital Debris Remediation:</strong> Autonomous rendezvous with non cooperative derelict spacecraft.
                </li>
              </ul>
            </div>
            <div className="landing-story-card__highlight">
              SYMBIOSIS provides the certifiable autonomous decision layer required for deep space operations.
            </div>
          </article>

        </div>

        {/* Call to Action Box */}
        <div className="landing-cta-banner">
          <span className="text-xs uppercase tracking-widest text-[#f7b8cb] font-semibold mb-2">
            Interactive Technical Demonstration
          </span>
          <h3>Explore SYMBIOSIS Mission Control</h3>
          <p>
            Experience the real time multi agent arbitration pipeline, 6 DoF pose estimation, Hyperdimensional cognitive memory, and the Recoverable Error Path workflow.
          </p>
          <button 
            className="btn-sakura-pearl"
            onClick={onLaunchClick}
          >
            Launch Live Mission Control Dashboard
          </button>
        </div>

      </div>
    </section>
  );
};
export default LandingStory;
