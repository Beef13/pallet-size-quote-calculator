/* ------------------------------------------------------------------
   Walkthrough: one quote, start to finish, driven by the scroll.

   What plays in the pinned window is the calculator itself: a run of
   screenshots taken from the real app at each moment of making one
   quote, plus the two PDFs it produced. Scrolling moves through them,
   closing in on whatever is being used at that moment.

   To retake the frames after the app changes, see HANDOFF.md
   ("Landing page walkthrough").
   ------------------------------------------------------------------ */

import './walkthrough.css'

const urls = import.meta.glob('./img/walk/*.webp', { eager: true, query: '?url', import: 'default' })
const url = (name) => urls[`./img/walk/${name}.webp`]

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (a, b, x) => clamp((x - a) / (b - a))
const ease = (x) => x * x * (3 - 2 * x)
const lerp = (a, b, p) => a + (b - a) * p

const FRAME_W = 1120, FRAME_H = 760
const SHEET_W = 420, SHEET_H = 594
const STEPS = 6

// Where to look, as [centre x, centre y, zoom] of the app window: wide = desktop, narrow = phone
const PANEL = { wide: [0.3, 0.5, 1.22], narrow: [0.18, 0.5, 1.85] }
const WHOLE = { wide: [0.5, 0.5, 1], narrow: [0.66, 0.52, 1.3] }
const at = (wide, narrow) => ({ wide, narrow })

// t is the position in the story: the whole number is the step, the fraction how far through it
const FRAMES = [
  { t: 0.0, img: 'a0-empty', look: at([0.28, 0.46, 1.4], [0.18, 0.45, 1.85]) },
  { t: 0.32, img: 'a1-width', look: at([0.28, 0.46, 1.4], [0.18, 0.45, 1.85]) },
  { t: 0.62, img: 'a2-length', look: WHOLE },
  { t: 1.06, img: 'b0-bottom-empty', look: at([0.3, 0.5, 1.22], [0.18, 0.42, 1.85]) },
  { t: 1.26, img: 'b1-bottom', look: WHOLE },
  { t: 1.44, img: 'b2-rest-empty', look: PANEL },
  { t: 1.6, img: 'b3-bearers', look: WHOLE },
  { t: 1.74, img: 'b4-top5', look: WHOLE },
  { t: 1.84, img: 'b5-top6', look: WHOLE },
  { t: 1.95, img: 'b6-top7', look: WHOLE },
  { t: 2.26, img: 'c0-top8', look: at([0.5, 0.5, 1], [0.64, 0.56, 1.4]) },
  { t: 2.46, img: 'c1-top9', look: at([0.5, 0.5, 1], [0.64, 0.56, 1.4]) },
  { t: 2.68, img: 'c0-top8', look: at([0.5, 0.5, 1], [0.64, 0.56, 1.4]) },
  { t: 2.88, img: 'b6-top7', look: WHOLE },
  { t: 3.14, img: 'd0-prices', look: at([0.26, 0.4, 1.5], [0.18, 0.4, 1.85]) },
  { t: 3.38, img: 'd1-quote1', look: PANEL },
  { t: 3.56, img: 'd2-quote250', look: at([0.72, 0.3, 1.56], [0.8, 0.2, 2]) },
  { t: 3.74, img: 'd3-quote-mid', look: at([0.3, 0.6, 1.3], [0.18, 0.6, 1.85]) },
  { t: 3.92, img: 'd4-quote-totals', look: at([0.28, 0.64, 1.45], [0.18, 0.66, 1.85]) },
  { t: 5.3, img: 'e0-history', look: at([0.28, 0.42, 1.4], [0.18, 0.4, 1.85]) }
]

export function setupWalkthrough() {
  const stage = document.getElementById('stage')
  const steps = [...document.querySelectorAll('.walk-step')]
  if (!stage || steps.length !== STEPS) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pin = stage.closest('.walk-pin')
  const reel = stage.querySelector('.stage-reel')
  const sheets = stage.querySelector('.stage-sheets')
  const sheetFront = stage.querySelector('.sheet-customer')
  const sheetBack = stage.querySelector('.sheet-yours')

  // One image per distinct screenshot, stacked. They are fetched as the section comes near.
  const layers = new Map()
  for (const name of new Set(FRAMES.map(f => f.img))) {
    const img = document.createElement('img')
    img.alt = ''
    img.width = FRAME_W
    img.height = FRAME_H
    img.decoding = 'async'
    img.dataset.src = url(name)
    reel.appendChild(img)
    layers.set(name, img)
  }
  const first = layers.get(FRAMES[0].img)
  first.src = first.dataset.src
  first.style.opacity = '1'

  let loaded = false
  const load = () => {
    if (loaded) return
    loaded = true
    for (const img of layers.values()) if (!img.src) img.src = img.dataset.src
    stage.querySelectorAll('img[data-sheet]').forEach(img => { if (!img.src) img.src = url(img.dataset.sheet) })
  }
  new IntersectionObserver((entries, observer) => {
    if (entries.some(e => e.isIntersecting)) { load(); observer.disconnect() }
  }, { rootMargin: '1200px 0px' }).observe(stage)

  let stageW = 0, stageH = 0, narrow = false
  const measure = () => {
    stageW = stage.clientWidth
    stageH = stage.clientHeight
    narrow = window.innerWidth <= 960
  }
  new ResizeObserver(() => { measure(); wake() }).observe(stage)
  measure()

  const ready = (img) => img.complete && img.naturalWidth > 0

  /* ---------- Draw one moment of the story (t runs from 0 to 6) ---------- */

  function draw(t) {
    // Which screenshot, and how far into the change to the next one
    let k = 0
    while (k < FRAMES.length - 1 && t >= FRAMES[k + 1].t) k++
    const here = FRAMES[k], next = FRAMES[k + 1]
    let blend = 0, travel = 0
    if (next) {
      const span = next.t - here.t
      travel = ease(seg(here.t, next.t, t))
      blend = ease(seg(next.t - Math.min(0.12, span * 0.5), next.t, t))
      if (!ready(layers.get(next.img))) blend = 0
    }
    for (const [name, img] of layers) {
      const on = name === here.img ? 1 : (next && name === next.img ? blend : 0)
      // the lower of the two stays solid so the window never goes see-through mid-change
      const solid = name === here.img || on > 0
      img.style.visibility = solid ? 'visible' : 'hidden'
      img.style.opacity = name === here.img ? '1' : on.toFixed(3)
      img.style.zIndex = name === here.img ? '1' : '2'
    }

    // Where to look: ease from this frame's view to the next one's
    const key = narrow ? 'narrow' : 'wide'
    const a = here.look[key], b = next ? next.look[key] : a
    const cx = lerp(a[0], b[0], travel), cy = lerp(a[1], b[1], travel), zoom = lerp(a[2], b[2], travel)
    const scale = Math.max(stageW / FRAME_W, stageH / FRAME_H) * zoom
    const w = FRAME_W * scale, h = FRAME_H * scale
    const x = clamp(stageW / 2 - cx * w, stageW - w, 0)
    const y = clamp(stageH / 2 - cy * h, stageH - h, 0)
    reel.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`

    // The drawing arrives as the customer's PDF, pulls back to show both PDFs, then they clear
    const enter = ease(seg(4.04, 4.42, t))
    const out = ease(seg(5.04, 5.36, t))
    const back = ease(seg(5.14, 5.46, t))
    const leave = ease(seg(5.62, 5.9, t))
    sheets.style.visibility = enter > 0 && leave < 1 ? 'visible' : 'hidden'
    reel.style.opacity = (1 - enter * 0.8 * (1 - leave)).toFixed(3)

    const sw = stageW, sh = stageH
    // close: the drawing fills the window. far: the whole page fits, with room for a second beside it
    const close = Math.min((sw * 0.96) / 322, (sh * 0.96) / 312)
    const far = Math.min((sh * 0.9) / SHEET_H, (sw * 0.45) / SHEET_W)
    const s = lerp(close, far, out)
    const drop = (1 - enter) * sh * 1.1 + leave * sh * 1.1
    const tx = lerp(sw / 2 - 210 * close, sw * 0.26 - 210 * far, out)
    const ty = lerp(sh / 2 - 214 * close, sh / 2 - (SHEET_H / 2) * far, out) + drop
    sheetFront.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`
    const bx = sw * 0.26 - 210 * far + back * sw * 0.48
    const by = sh / 2 - (SHEET_H / 2) * far + back * 6 + leave * sh * 1.25
    sheetBack.style.transform = `translate(${bx.toFixed(2)}px, ${by.toFixed(2)}px) scale(${far.toFixed(4)}) rotate(${(back * 1.2).toFixed(2)}deg)`
    sheetBack.style.opacity = seg(5.1, 5.2, t).toFixed(3)
  }

  /* ---------- Follow the scroll ---------- */

  let target = 0, shown = 0, last = 0, running = false, active = -1

  function readScroll() {
    // Desktop: a step plays as it crosses the middle of the window. Phone: it plays while its
    // words are held under the pinned window.
    const anchor = narrow ? pin.offsetHeight + 10 : window.innerHeight * 0.56
    let t = 0
    for (let i = 0; i < steps.length; i++) {
      const r = steps[i].getBoundingClientRect()
      if (anchor >= r.bottom) { t = i + 1; continue }
      if (anchor > r.top) t = i + (anchor - r.top) / r.height
      break
    }
    // With reduced motion each step simply shows its finished state
    target = reduceMotion ? Math.min(STEPS, Math.floor(t) + (t > 0 ? 0.999 : 0)) : t
    const now = Math.min(STEPS - 1, Math.floor(t))
    if (now !== active) {
      active = now
      steps.forEach((s, i) => s.classList.toggle('active', i === now))
    }
    wake()
  }

  function frame(now) {
    const dt = Math.min(64, now - last || 16)
    last = now
    const gap = target - shown
    shown = reduceMotion || Math.abs(gap) < 0.0005 ? target : shown + gap * (1 - Math.exp(-dt / 120))
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

  // A frame that finishes loading mid-scroll should appear without waiting for the next scroll
  for (const img of layers.values()) img.addEventListener('load', wake)
  window.addEventListener('scroll', readScroll, { passive: true })
  window.addEventListener('resize', () => { measure(); readScroll() })
  readScroll()
}
