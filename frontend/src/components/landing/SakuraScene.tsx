import React, { useEffect, useState } from 'react';

const PETAL_COLORS: [string, string][] = [
  ['#fbe3ea', '#f7b8cb'],
  ['#f7b8cb', '#e191ab'],
  ['#f0c9d6', '#d97fa0'],
  ['#fff0f4', '#f0b4c4'],
];

interface PetalData {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: string;
  spin: number;
  c1: string;
  c2: string;
}

function makePetals(count: number): PetalData[] {
  return Array.from({ length: count }).map((_, i) => {
    const size = 9 + Math.random() * 14;
    const [c1, c2] = PETAL_COLORS[i % PETAL_COLORS.length];
    return {
      id: i,
      left: Math.random() * 100,
      size,
      duration: 9 + Math.random() * 10,
      delay: -Math.random() * 18,
      drift: `${Math.round((Math.random() * 2 - 1) * 90)}px`,
      spin: Math.random() > 0.5 ? 1 : -1,
      c1,
      c2,
    };
  });
}

export const SakuraScene: React.FC = () => {
  const [petals, setPetals] = useState<PetalData[]>([]);

  useEffect(() => {
    setPetals(makePetals(36));
  }, []);

  return (
    <div className="sakura" aria-hidden="true">
      <svg
        className="sakura__canopy"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bloomTL" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f7b8cb" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f7b8cb" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bloomTR" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e191ab" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e191ab" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* atmospheric blossom bokeh */}
        <ellipse cx="140" cy="60" rx="420" ry="300" fill="url(#bloomTL)" />
        <ellipse cx="1320" cy="120" rx="460" ry="320" fill="url(#bloomTR)" />

        {/* branches sweeping in from the top corners */}
        <g stroke="#1c0d13" strokeLinecap="round" fill="none">
          <path d="M -20 40 C 180 20, 260 140, 420 120 S 640 60, 760 130" strokeWidth="7" opacity="0.9" />
          <path d="M 120 70 C 200 120, 220 180, 300 210" strokeWidth="4" opacity="0.8" />
          <path d="M 340 118 C 400 150, 430 210, 470 260" strokeWidth="3.5" opacity="0.75" />
          <path
            d="M 1460 30 C 1260 10, 1180 130, 1020 110 S 800 70, 700 150"
            strokeWidth="7"
            opacity="0.9"
          />
          <path d="M 1300 65 C 1220 115, 1200 175, 1120 205" strokeWidth="4" opacity="0.8" />
          <path d="M 1080 112 C 1020 145, 990 205, 950 250" strokeWidth="3.5" opacity="0.75" />
        </g>

        {/* blossom clusters along the branches */}
        <g>
          {[
            [40, 55], [95, 35], [150, 65], [210, 45], [260, 95], [310, 130],
            [370, 105], [420, 140], [470, 170], [520, 205], [1400, 45], [1345, 25],
            [1290, 55], [1230, 35], [1180, 85], [1130, 120], [1070, 95], [1020, 130],
            [970, 160], [920, 195],
          ].map(([cx, cy], idx) => (
            <g key={idx} opacity={0.85 - (idx % 5) * 0.08}>
              <circle cx={cx} cy={cy} r={9 + (idx % 4) * 2.5} fill="#f7b8cb" />
              <circle cx={cx + 8} cy={cy + 5} r={6 + (idx % 3) * 2} fill="#fbe3ea" />
              <circle cx={cx - 7} cy={cy + 4} r={5 + (idx % 3) * 2} fill="#e191ab" />
            </g>
          ))}
        </g>
      </svg>

      <div className="sakura__petals">
        {petals.map((p) => (
          <span
            key={p.id}
            className="petal"
            style={{
              // @ts-ignore
              '--left': `${p.left}%`,
              '--size': `${p.size}px`,
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
              '--drift': p.drift,
              '--spin': p.spin,
              '--c1': p.c1,
              '--c2': p.c2,
            }}
          />
        ))}
      </div>
    </div>
  );
};
export default SakuraScene;
