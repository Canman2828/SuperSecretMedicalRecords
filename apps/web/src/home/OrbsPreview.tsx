// A still "screenshot" of the Prescriptive 3D tree for the home page card: three glowing orbs
// (medicine, food, substance) joined by red / yellow / green cables. Plain SVG, no WebGL.
// Colors match apps/web/src/prescriptive/status.ts.

const ORBS = {
  med: { x: 150, y: 38, r: 19, light: '#E4DEF7', base: '#8C7FC0', dark: '#5B5090' },
  food: { x: 66, y: 68, r: 15, light: '#F8E0D5', base: '#D49A82', dark: '#A56852' },
  star: { x: 234, y: 68, r: 15, light: '#F4E4B4', base: '#C9A44C', dark: '#916F24' },
};

// Quadratic "hanging cable" curves between orb centers; `dot` is the midpoint where a light pulse sits.
const CABLES = [
  { d: 'M150 38 Q96 86 66 68', color: '#E0455B', dot: [102, 69.5] },
  { d: 'M150 38 Q204 86 234 68', color: '#3FB56F', dot: [198, 69.5] },
  { d: 'M66 68 Q150 118 234 68', color: '#F0B429', dot: [150, 93] },
];

export function OrbsPreview() {
  return (
    <svg className="mini-orbs" viewBox="30 2 240 108" aria-hidden="true">
      <defs>
        {Object.entries(ORBS).map(([id, o]) => (
          <g key={id}>
            <radialGradient id={`orb-body-${id}`} cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor={o.light} />
              <stop offset="50%" stopColor={o.base} />
              <stop offset="100%" stopColor={o.dark} />
            </radialGradient>
            <radialGradient id={`orb-halo-${id}`}>
              <stop offset="35%" stopColor={o.base} stopOpacity=".5" />
              <stop offset="100%" stopColor={o.base} stopOpacity="0" />
            </radialGradient>
          </g>
        ))}
        <filter id="orb-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>

      {/* cables: soft glow, colored tube, thin highlight, light pulse */}
      {CABLES.map((c) => (
        <g key={c.d} fill="none" strokeLinecap="round">
          <path d={c.d} stroke={c.color} strokeWidth="9" opacity=".22" filter="url(#orb-soft)" />
          <path d={c.d} stroke={c.color} strokeWidth="4.5" />
          <path d={c.d} stroke="#fff" strokeWidth="1.3" opacity=".45" transform="translate(0 -1)" />
          <circle cx={c.dot[0]} cy={c.dot[1]} r="3.2" fill="#fff" opacity=".9" />
        </g>
      ))}

      {Object.entries(ORBS).map(([id, o]) => (
        <g key={id}>
          <circle cx={o.x} cy={o.y} r={o.r * 2.1} fill={`url(#orb-halo-${id})`} />
          <ellipse cx={o.x} cy={o.y + o.r + 7} rx={o.r * 0.85} ry={o.r * 0.2} fill="#6E698C" opacity=".25" filter="url(#orb-soft)" />
          <circle cx={o.x} cy={o.y} r={o.r} fill={`url(#orb-body-${id})`} />
          <ellipse cx={o.x - o.r * 0.34} cy={o.y - o.r * 0.46} rx={o.r * 0.36} ry={o.r * 0.2} fill="#fff" opacity=".6" transform={`rotate(-28 ${o.x - o.r * 0.34} ${o.y - o.r * 0.46})`} />
        </g>
      ))}

      {/* icons, like the 3D orbs: two-tone pill, fork & knife, star */}
      <g transform="rotate(-45 150 38)">
        <rect x="140" y="33.8" width="20" height="8.4" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
        <path d="M150 33.8H144.2a4.2 4.2 0 0 0 0 8.4H150z" fill="#fff" />
      </g>
      <svg x="58" y="60" width="16" height="16" viewBox="0 0 24 24" overflow="visible">
        <use href="#i-food" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg x="226.5" y="60.5" width="15" height="15" viewBox="0 0 24 24" overflow="visible">
        <use href="#i-star" fill="#fff" />
      </svg>
    </svg>
  );
}
