/* Hand-drawn motion lines, comic-book style, laid over the 3D models while they move.
   Each line is a wedge that is thickest next to the thing that is moving and tapers
   to a point behind it, with a thin pencil stroke beside it. The lines are redrawn
   with a slightly different wobble as the motion goes on, like a sketch that "boils",
   and they fade away as soon as the motion stops, so nothing is left on the page at rest. */
const NS = 'http://www.w3.org/2000/svg'

// A repeatable scatter: the same seed always gives the same wobble
const noise = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

const f = (n) => n.toFixed(1)

// A wedge along the points: full width at the first point, nothing at the last
const wedge = (pts, width, seed) => {
  const left = []
  const right = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i]
    const [ax, ay] = pts[Math.max(0, i - 1)]
    const [bx, by] = pts[Math.min(n - 1, i + 1)]
    const len = Math.hypot(bx - ax, by - ay) || 1
    const nx = -(by - ay) / len
    const ny = (bx - ax) / len
    const along = i / (n - 1)
    const half = width * 0.5 * (1 - along) ** 1.4
    // One slow sway along the length, growing towards the tail where a quick stroke
    // is least steady: a hand-drawn line bends, it does not zigzag
    const drift = Math.sin(along * (2.2 + noise(seed) * 1.2) + noise(seed + 1) * 3) * width * 0.45 * along
    left.push([x + nx * (half + drift), y + ny * (half + drift)])
    right.push([x - nx * (half - drift), y - ny * (half - drift)])
  }
  const all = left.concat(right.reverse())
  return `M${all.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
}

// The pencil stroke beside it: the same path, a little off to one side and unsteady
const pencil = (pts, width, seed) => {
  const n = pts.length
  const side = noise(seed) > 0 ? 1 : -1
  return pts.map(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)]
    const [bx, by] = pts[Math.min(n - 1, i + 1)]
    const len = Math.hypot(bx - ax, by - ay) || 1
    const off = side * (width * 0.9 + 2) + Math.sin(i * 0.9 + noise(seed + 2) * 3) * 1.1
    return `${i ? 'L' : 'M'}${f(x - (by - ay) / len * off)} ${f(y + (bx - ax) / len * off)}`
  }).join('')
}

export function mountSketch(stage, name) {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', `sketch-lines ${name}`)
  svg.setAttribute('aria-hidden', 'true')
  const fills = document.createElementNS(NS, 'path')
  fills.setAttribute('class', 'sketch-fill')
  const strokes = document.createElementNS(NS, 'path')
  strokes.setAttribute('class', 'sketch-stroke')
  svg.append(fills, strokes)
  stage.append(svg)

  let rest = 0
  let shown = false
  const clear = () => {
    if (!shown) return
    shown = false
    svg.classList.remove('moving')
  }

  return {
    /* lines: [{ pts: [[x, y], ...] from the moving thing back along its path, width }]
       in pixels within the stage. frame: a number that changes as the motion goes on;
       the wobble is redrawn each time its whole part changes. strength: 0 to 1. */
    draw(lines, frame, strength = 1) {
      const seed = Math.floor(frame)
      let a = ''
      let b = ''
      lines.forEach((line, i) => {
        if (line.pts.length < 2) return
        const [x0, y0] = line.pts[0]
        const [x1, y1] = line.pts[line.pts.length - 1]
        if (Math.hypot(x1 - x0, y1 - y0) < 16) return
        a += wedge(line.pts, line.width, seed * 13 + i * 101)
        // Every other line gets the pencil stroke, so the set looks drawn, not stamped
        if ((i + seed) % 2 === 0) b += pencil(line.pts, line.width, seed * 17 + i * 53)
      })
      fills.setAttribute('d', a)
      strokes.setAttribute('d', b)
      svg.style.setProperty('--strength', strength.toFixed(2))
      clearTimeout(rest)
      if (!a) { clear(); return }
      shown = true
      svg.classList.add('moving')
      // Nothing is moving once the scrolling stops, so the lines go
      rest = setTimeout(clear, 140)
    },
    clear
  }
}
