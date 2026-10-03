/* ------------------------------------------------------------------
   Showcase: one quote, start to finish, played by the scroll.

   The calculator is shown in pieces. Every piece is a capture of the
   real app (a section of the build panel, the 3D pallet on its own,
   the price card, the two PDFs) and each one moves independently as
   the page scrolls, so the pallet can hold the middle of the screen
   while the controls that shape it come and go around it.

   To retake the pieces after the app changes, see HANDOFF.md
   ("Landing page showcase").
   ------------------------------------------------------------------ */

import './showcase.css'

const urls = import.meta.glob('./img/show/*.webp', { eager: true, query: '?url', import: 'default' })
const url = (name) => urls[`./img/show/${name}.webp`]

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (a, b, x) => clamp((x - a) / (b - a))
const ease = (x) => x * x * (3 - 2 * x)
const lerp = (a, b, p) => a + (b - a) * p

const SCENES = 6
// Design canvases the positions below are written for: [width, height]. The stage is scaled to fit.
const CANVAS = { wide: [1440, 860], narrow: [430, 860] }

// The deck goes 7 -> 8 -> 9 -> 8 -> 7 in scene 3; these pieces all change together
const deck = (prefix) => [[0, `${prefix}7`], [2.3, `${prefix}8`], [2.5, `${prefix}9`], [2.72, `${prefix}8`], [2.9, `${prefix}7`]]

/* Each piece: its width on the design canvas, the captures it shows over time ([from t, name]),
   and where it is at given moments, as [t, x, y, scale, opacity, rotation] measured from the
   centre of the stage. t counts scenes: 2.5 is halfway through the third. */
const PIECES = [
  {
    id: 'pallet', kind: 'bare', width: 640,
    states: [[0, 'pallet-ghost'], [1.2, 'pallet-bottom'], [1.48, 'pallet-bearers'], [1.74, 'pallet-top7'],
      [2.3, 'pallet-top8'], [2.5, 'pallet-top9'], [2.72, 'pallet-top8'], [2.9, 'pallet-top7']],
    wide: [[0.45, 190, 110, 0.8, 0], [0.8, 190, 95, 0.95, 1], [1.0, 190, 95, 0.95, 1], [1.15, 0, 95, 1, 1], [2.0, 0, 95, 1, 1],
      [2.15, 90, 45, 1.05, 1], [3.0, 90, 45, 1.05, 1], [3.2, 330, 95, 0.72, 1], [3.95, 330, 95, 0.72, 1], [4.12, 330, 95, 0.72, 0]],
    narrow: [[0.45, 0, 10, 0.5, 0], [0.8, 0, -10, 0.6, 1], [2.0, 0, -10, 0.6, 1], [2.15, 0, -20, 0.62, 1], [2.98, 0, -20, 0.62, 1], [3.14, 0, -50, 0.55, 0]]
  },
  {
    id: 'size', kind: 'card', width: 436,
    states: [[0, 'card-size-empty'], [0.2, 'card-size-width'], [0.38, 'card-size']],
    wide: [[-0.2, 0, 170, 1.1, 0], [0, 0, 110, 1.2, 1], [0.45, 0, 110, 1.2, 1], [0.8, -400, 90, 0.95, 1], [0.98, -400, 90, 0.95, 1], [1.12, -580, 90, 0.85, 0]],
    narrow: [[-0.2, 0, 130, 0.85, 0], [0, 0, 70, 0.9, 1], [0.45, 0, 70, 0.9, 1], [0.8, 0, 255, 0.8, 1], [0.98, 0, 255, 0.8, 1], [1.1, 0, 330, 0.8, 0]]
  },
  {
    id: 'bottom', kind: 'card', width: 436, states: [[0, 'card-bottom']],
    wide: [[1.02, -640, -30, 0.8, 0], [1.16, -470, -30, 0.82, 1], [1.95, -470, -30, 0.82, 1], [2.1, -640, -30, 0.8, 0]],
    narrow: [[1.02, 0, 340, 0.8, 0], [1.16, 0, 255, 0.8, 1], [1.3, 0, 255, 0.8, 1], [1.42, 0, 200, 0.76, 0]]
  },
  {
    id: 'bearers', kind: 'card', width: 436, states: [[0, 'card-bearers']],
    wide: [[1.3, 640, -45, 0.8, 0], [1.44, 470, -45, 0.82, 1], [1.95, 470, -45, 0.82, 1], [2.1, 640, -45, 0.8, 0]],
    narrow: [[1.32, 0, 340, 0.8, 0], [1.44, 0, 255, 0.8, 1], [1.56, 0, 255, 0.8, 1], [1.68, 0, 200, 0.76, 0]]
  },
  {
    id: 'top', kind: 'card', width: 436, states: deck('card-top'),
    wide: [[1.56, -640, 205, 0.8, 0], [1.7, -470, 205, 0.82, 1], [1.95, -470, 205, 0.82, 1], [2.15, -470, 60, 0.9, 1], [2.95, -470, 60, 0.9, 1], [3.1, -660, 60, 0.85, 0]],
    narrow: [[1.58, 0, 340, 0.8, 0], [1.7, 0, 255, 0.8, 1], [2.0, 0, 255, 0.8, 1], [2.15, 0, 280, 0.8, 1], [2.95, 0, 280, 0.8, 1], [3.1, 0, 350, 0.8, 0]]
  },
  {
    id: 'stamp', kind: 'stamp', width: 250, states: [...deck('stamp-top'), [3.62, 'stamp-250']],
    wide: [[1.74, 470, 140, 0.8, 0], [1.86, 470, 160, 0.9, 1], [1.95, 470, 160, 0.9, 1], [2.15, 520, -110, 0.9, 1], [2.95, 520, -110, 0.9, 1],
      [3.2, 330, -130, 0.9, 1], [3.95, 330, -130, 0.9, 1], [4.12, 330, -150, 0.9, 0]],
    narrow: [[1.74, 120, -150, 0.5, 0], [1.86, 118, -128, 0.56, 1], [2.95, 118, -128, 0.56, 1], [3.1, 118, -128, 0.56, 0],
      [3.5, 0, -60, 0.72, 0], [3.66, 0, -92, 0.76, 1], [3.95, 0, -92, 0.76, 1], [4.1, 0, -110, 0.76, 0]]
  },
  {
    id: 'slider', kind: 'slider', width: 280, states: deck('slider-'),
    wide: [[2.08, 90, 400, 1, 0], [2.2, 90, 330, 1, 1], [2.95, 90, 330, 1, 1], [3.1, 90, 400, 1, 0]],
    narrow: [[2.08, 0, 150, 0.9, 0], [2.2, 0, 118, 0.9, 1], [2.95, 0, 118, 0.9, 1], [3.1, 0, 150, 0.9, 0]]
  },
  {
    id: 'rates', kind: 'flush', width: 392, states: [[0, 'card-rates']],
    wide: [[3.02, -300, 210, 0.95, 0], [3.18, -250, 90, 1.05, 1], [3.42, -250, 90, 1.05, 1], [3.6, -520, -40, 0.7, 1], [3.95, -520, -40, 0.7, 1], [4.1, -560, -40, 0.7, 0]],
    narrow: [[3.02, 0, 170, 0.85, 0], [3.16, 0, 70, 0.9, 1], [3.4, 0, 70, 0.9, 1], [3.56, 0, -40, 0.8, 0]]
  },
  {
    id: 'totals', kind: 'flush', width: 392, states: [[0, 'card-totals']],
    wide: [[3.45, -160, 430, 0.95, 0], [3.66, -160, 95, 0.95, 1], [3.95, -160, 95, 0.95, 1], [4.12, -160, 50, 0.95, 0]],
    narrow: [[3.45, 0, 420, 0.88, 0], [3.66, 0, 150, 0.88, 1], [3.95, 0, 150, 0.88, 1], [4.1, 0, 120, 0.88, 0]]
  },
  {
    id: 'yours', kind: 'sheet', width: 420, states: [[0, 'sheet-breakdown']],
    wide: [[5.1, 0, 112, 0.94, 0, 0], [5.3, 185, 114, 0.94, 1, 2], [5.55, 185, 114, 0.94, 1, 2], [5.75, 195, 30, 0.78, 1, 2]],
    narrow: [[5.1, 0, 120, 0.48, 0, 0], [5.3, 104, 66, 0.48, 1, 2], [5.55, 104, 66, 0.48, 1, 2], [5.75, 104, 26, 0.48, 1, 2]]
  },
  {
    id: 'customer', kind: 'sheet', width: 420, states: [[0, 'sheet-customer']],
    wide: [[4.04, 0, 900, 1.55, 1], [4.4, 0, 249, 1.55, 1], [4.6, 0, 249, 1.55, 1], [4.95, 0, 112, 0.98, 1], [5.05, 0, 112, 0.98, 1],
      [5.3, -185, 108, 0.94, 1], [5.55, -185, 108, 0.94, 1], [5.75, -195, 25, 0.78, 1]],
    narrow: [[4.04, 0, 900, 1.25, 1], [4.4, 0, 184, 1.25, 1], [4.6, 0, 184, 1.25, 1], [4.95, 0, 120, 0.9, 1], [5.05, 0, 120, 0.9, 1],
      [5.3, -104, 60, 0.48, 1], [5.55, -104, 60, 0.48, 1], [5.75, -104, 20, 0.48, 1]]
  },
  {
    id: 'history', kind: 'card', width: 436, states: [[0, 'card-history']],
    wide: [[5.6, 0, 470, 1, 0], [5.8, 0, 345, 1, 1]],
    narrow: [[5.6, 0, 390, 0.85, 0], [5.8, 0, 262, 0.9, 1]]
  }
]

export function setupShowcase() {
  const section = document.querySelector('.show')
  const stage = document.getElementById('show-stage')
  const texts = [...document.querySelectorAll('.show-step')]
  if (!section || !stage || texts.length !== SCENES) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------- Build the pieces ---------- */

  const pieces = PIECES.map(def => {
    const node = document.createElement('div')
    node.className = `piece piece-${def.kind}`
    node.style.width = `${def.width}px`
    const images = new Map()
    for (const [, name] of def.states) {
      if (images.has(name)) continue
      const img = document.createElement('img')
      img.alt = ''
      img.decoding = 'async'
      img.dataset.src = url(name)
      node.appendChild(img)
      images.set(name, img)
    }
    stage.appendChild(node)
    return { ...def, node, images, last: 'hidden' }
  })

  // Fetch the captures as the section comes near, not on page load
  const load = () => pieces.forEach(p => p.images.forEach(img => { if (!img.src) img.src = img.dataset.src }))
  new IntersectionObserver((entries, observer) => {
    if (entries.some(e => e.isIntersecting)) { load(); observer.disconnect() }
  }, { rootMargin: '1400px 0px' }).observe(section)
  pieces.forEach(p => p.images.forEach(img => img.addEventListener('load', () => wake())))

  /* ---------- Measure once per resize, never per frame ---------- */

  // How far above and below the centre of the stage the pieces reach, in design units
  const REACH = { wide: [215, 430], narrow: [190, 420] }
  const steps = section.querySelector('.show-steps')

  let top = 0, travel = 1, unit = 1, layout = 'wide', midY = 0
  function measure() {
    const vw = window.innerWidth, vh = stage.clientHeight
    layout = vw <= 820 ? 'narrow' : 'wide'
    const [cw] = CANVAS[layout]
    const [up, down] = REACH[layout]
    // The pieces get whatever height is left under the tallest block of words
    const wordsEnd = steps.offsetTop + Math.max(...texts.map(n => n.offsetHeight)) + 14
    unit = Math.max(0.3, Math.min(vw / cw, (vh - wordsEnd) / (up + down)))
    midY = wordsEnd + up * unit - vh / 2
    const track = section.querySelector('.show-track')
    top = track.getBoundingClientRect().top + window.scrollY
    travel = Math.max(1, track.offsetHeight - vh)
  }

  /* ---------- Draw one moment (t runs from 0 to 6) ---------- */

  const ready = (img) => img.complete && img.naturalWidth > 0

  function place(piece, t) {
    const keys = piece[layout]
    let i = 0
    while (i < keys.length - 1 && t >= keys[i + 1][0]) i++
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)]
    const p = b === a ? 0 : ease(seg(a[0], b[0], t))
    const opacity = t < keys[0][0] ? keys[0][4] : lerp(a[4], b[4], p)
    const { node } = piece
    if (opacity <= 0.001) {
      if (piece.last !== 'hidden') { node.style.visibility = 'hidden'; piece.last = 'hidden' }
      return
    }
    const x = lerp(a[1], b[1], p) * unit, y = lerp(a[2], b[2], p) * unit + midY
    const scale = lerp(a[3], b[3], p) * unit, turn = lerp(a[5] || 0, b[5] || 0, p)
    const style = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(4)})${turn ? ` rotate(${turn.toFixed(2)}deg)` : ''}`
    if (piece.last === 'hidden') node.style.visibility = 'visible'
    node.style.transform = style
    node.style.opacity = opacity.toFixed(3)
    piece.last = 'shown'

    // Which capture this piece is showing, with a short cross-fade into the next
    const states = piece.states
    if (states.length === 1) { const only = piece.images.get(states[0][1]); if (only.style.opacity !== '1') only.style.opacity = '1'; return }
    let s = 0
    while (s < states.length - 1 && t >= states[s + 1][0]) s++
    const here = states[s][1], next = states[s + 1]
    let blend = 0
    if (next && ready(piece.images.get(next[1]))) blend = ease(seg(next[0] - 0.07, next[0], t))
    for (const [name, img] of piece.images) {
      const on = name === here ? 1 : (next && name === next[1] ? blend : 0)
      img.style.opacity = on.toFixed(3)
      img.style.zIndex = name === here ? '1' : '2'
    }
  }

  function draw(t) {
    for (const piece of pieces) place(piece, t)
    texts.forEach((node, i) => {
      const enter = i === 0 ? 1 : ease(seg(i - 0.02, i + 0.1, t))
      const exit = i === SCENES - 1 ? 0 : ease(seg(i + 0.88, i + 0.98, t))
      const on = enter * (1 - exit)
      node.style.opacity = on.toFixed(3)
      node.style.transform = `translate3d(0, ${((1 - enter) * 22 - exit * 14).toFixed(1)}px, 0)`
      node.style.visibility = on > 0.001 ? 'visible' : 'hidden'
    })
  }

  /* ---------- Follow the scroll, eased ---------- */

  let target = 0, shown = 0, last = 0, running = false

  function readScroll() {
    const p = clamp((window.scrollY - top) / travel)
    let t = Math.min(SCENES, p * (SCENES + 0.12))
    // With reduced motion each scene simply shows its finished state
    if (reduceMotion) t = Math.min(SCENES, Math.floor(Math.min(t, SCENES - 0.001)) + 0.97)
    target = t
    wake()
  }

  function frame(now) {
    const dt = Math.min(50, now - last || 16)
    last = now
    const gap = target - shown
    shown = reduceMotion || Math.abs(gap) < 0.0004 ? target : shown + gap * (1 - Math.exp(-dt / 140))
    draw(shown)
    if (shown !== target) requestAnimationFrame(frame)
    else running = false
  }

  function wake() {
    if (running) return
    running = true
    last = performance.now()
    requestAnimationFrame(frame)
  }

  const onResize = () => { measure(); readScroll() }
  window.addEventListener('scroll', readScroll, { passive: true })
  window.addEventListener('resize', onResize)
  if (document.fonts?.ready) document.fonts.ready.then(onResize)
  window.addEventListener('load', onResize)
  section.classList.add('ready')
  onResize()
}
