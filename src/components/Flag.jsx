// Small drawn flags for the country choice. Drawn as SVG because flag emoji don't show on Windows.
// Both flags are 1:2, on a 60 x 30 grid.

const BLUE = '#012169'
const RED = '#C8102E'

// Points of a star with `n` tips, centred on (cx, cy), first tip pointing up
function star(cx, cy, outer, inner, n) {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}
const star7 = (cx, cy, r) => star(cx, cy, r, r * 4 / 9, 7)
const star5 = (cx, cy, r) => star(cx, cy, r, r * 0.382, 5)

// The Union Jack in the top-left quarter, shared by both flags
function Canton({ id }) {
  return (
    <svg x="0" y="0" width="30" height="15" viewBox="0 0 60 30">
      <clipPath id={`${id}-t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-t)`} stroke={RED} strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke={RED} strokeWidth="6" />
    </svg>
  )
}

const STARS = {
  AU: (
    <g fill="#fff">
      <polygon points={star7(15, 22.5, 4.5)} />
      <polygon points={star7(45, 25, 2.14)} />
      <polygon points={star7(37.5, 13.13, 2.14)} />
      <polygon points={star7(45, 5, 2.14)} />
      <polygon points={star7(51.67, 11.13, 2.14)} />
      <polygon points={star5(48, 16.25, 1.25)} />
    </g>
  ),
  NZ: (
    <g fill={RED} stroke="#fff" strokeWidth="0.7" strokeLinejoin="miter">
      <polygon points={star5(45, 6.2, 2.6)} />
      <polygon points={star5(51.6, 12.4, 2.2)} />
      <polygon points={star5(38.6, 13.6, 2.6)} />
      <polygon points={star5(45, 23.6, 3)} />
    </g>
  )
}

export default function Flag({ country, className = '' }) {
  if (!STARS[country]) return null
  return (
    <svg className={`flag ${className}`} viewBox="0 0 60 30" aria-hidden="true" focusable="false">
      <rect width="60" height="30" fill={BLUE} />
      <Canton id={`flag-${country}`} />
      {STARS[country]}
    </svg>
  )
}
