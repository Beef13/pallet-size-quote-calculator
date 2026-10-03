import '@fontsource-variable/outfit'
import './landing.css'
import timberData from '../data/timber-prices.json'
import { deckGapSize, maxDeckBoards, timberCost, formatCurrency } from '../utils/calculations'
import demoLight from './img/app-demo-light.mp4'
import demoDark from './img/app-demo-dark.mp4'
import demoLightWebm from './img/app-demo-light.webm'
import demoDarkWebm from './img/app-demo-dark.webm'
import posterLight from './img/app-demo-poster-light.webp'
import posterDark from './img/app-demo-poster-dark.webp'

const SVG_NS = 'http://www.w3.org/2000/svg'
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (parent) parent.appendChild(node)
  return node
}

// "$3,230.00" with the cents in a lighter span
function setMoney(node, value) {
  const [whole, cents] = formatCurrency(value).split('.')
  node.innerHTML = `${whole}<span class="cents">.${cents}</span>`
}

/* ------------------------------------------------------------------
   Bento: an isometric 1165 x 1165 pallet that assembles itself in one
   card while the ticket in the card beside it adds up the price.
   ------------------------------------------------------------------ */

function deck(count, boardW, boardT, palletW) {
  const gap = deckGapSize(palletW, count, boardW)
  return Array.from({ length: count }, (_, i) => ({ x: i * (boardW + gap), w: boardW, t: boardT }))
}

function buildHero() {
  const svg = document.getElementById('hero-pallet')
  if (!svg) return null
  svg.innerHTML = ''

  const W = 1165, L = 1165
  const bottom = deck(3, 100, 19, W)
  const top = deck(7, 100, 17, W)
  const bearerH = 100, bearerT = 38
  const bearerZ = [0, (L - bearerT) / 2, L - bearerT]
  const y0 = 19, y1 = 19 + bearerH, H = y1 + 17

  // Isometric projection centred in the 640 x 430 view box
  const C = Math.cos(Math.PI / 6), S = 0.5
  const raw = (x, y, z) => [(x - z) * C, (x + z) * S - y]
  const k = Math.min(440 / ((W + L) * C), 300 / ((W + L) * S + H))
  const ox = 320 - ((W - L) * C * k) / 2
  const oy = 50 + H * k
  const P = (x, y, z) => { const [u, v] = raw(x, y, z); return [ox + u * k, oy + v * k] }
  const pts = (...p) => p.map(q => q.join(',')).join(' ')

  // Soft shadow on the floor
  el('polygon', { class: 'shadow-blob', points: pts(P(-30, 0, -30), P(W + 30, 0, -30), P(W + 30, 0, L + 30), P(-30, 0, L + 30)) }, svg)

  let order = 0
  const box = (b, cls, delay) => {
    const g = el('g', { class: `part ${cls}`, style: `--i: ${delay}` }, svg)
    el('polygon', { class: 'face-left', points: pts(P(b.x0, b.y0, b.z1), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)) }, g)
    el('polygon', { class: 'face-right', points: pts(P(b.x1, b.y0, b.z0), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x1, b.y1, b.z0)) }, g)
    el('polygon', { class: 'face-top', points: pts(P(b.x0, b.y1, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)) }, g)
    order++
    return g
  }

  // Draw back to front, bottom layer up (painter's algorithm)
  bottom.forEach((b, i) => box({ x0: b.x, x1: b.x + b.w, y0: 0, y1: b.t, z0: 0, z1: L }, 'board', 80 + i * 110))
  bearerZ.forEach((z, i) => box({ x0: 0, x1: W, y0, y1, z0: z, z1: z + bearerT }, 'bearer', 760 + i * 130))
  top.forEach((b, i) => box({ x0: b.x, x1: b.x + b.w, y0: y1, y1: y1 + b.t, z0: 0, z1: L }, 'board', 1460 + i * 105))

  // Nail heads where each top board crosses a bearer
  const nails = el('g', {}, svg)
  top.forEach((b, i) => bearerZ.forEach(z => [0.25, 0.75].forEach(f => {
    const [cx, cy] = P(b.x + b.w * f, y1 + b.t, z + bearerT / 2)
    el('ellipse', { class: 'nail', cx, cy, rx: 1.6, ry: 0.95, style: `--i: ${2250 + i * 25}` }, nails)
  })))

  // Dimension lines along the two near edges
  const dim = (a, b, off, label, delay) => {
    const g = el('g', { class: 'dim', style: `--i: ${delay}` }, svg)
    const [ax, ay] = P(...a), [bx, by] = P(...b)
    const [oxA, oyA] = P(...off.a), [oxB, oyB] = P(...off.b)
    el('line', { x1: ax, y1: ay, x2: oxA, y2: oyA }, g)
    el('line', { x1: bx, y1: by, x2: oxB, y2: oyB }, g)
    el('line', { x1: oxA, y1: oyA, x2: oxB, y2: oyB }, g)
    const ang = Math.atan2(oyB - oyA, oxB - oxA) * 180 / Math.PI
    for (const [tx, ty] of [[oxA, oyA], [oxB, oyB]]) {
      el('path', { d: `M${tx - 4} ${ty + 4} L${tx + 4} ${ty - 4}`, transform: `rotate(${ang + 45 - 45} ${tx} ${ty})` }, g)
    }
    const mx = (oxA + oxB) / 2, my = (oyA + oyB) / 2
    const upright = ang > 90 || ang < -90 ? ang + 180 : ang
    const t = el('text', { x: mx, y: my - 8, 'text-anchor': 'middle', transform: `rotate(${upright} ${mx} ${my})` }, g)
    t.textContent = label
  }
  const g = 150
  dim([0, 0, L], [W, 0, L], { a: [0, 0, L + g], b: [W, 0, L + g] }, '1165', 2450)
  dim([W, 0, 0], [W, 0, L], { a: [W + g, 0, 0], b: [W + g, 0, L] }, '1165', 2600)

  return svg
}

const ticketSteps = [
  { at: 520, add: 2.62 },
  { at: 1250, add: 5.24 },
  { at: 2250, add: 5.06 }
]
const QTY = 250

function playHero() {
  const svg = buildHero()
  const ticket = document.getElementById('ticket')
  const total = document.getElementById('ticket-total')
  if (!svg || !ticket || !total) return

  const lines = [...ticket.querySelectorAll('.ticket-lines li')]
  const finalTotal = ticketSteps.reduce((s, x) => s + x.add, 0) * QTY

  if (reduceMotion) {
    setMoney(total, finalTotal)
    return
  }

  svg.classList.remove('building')
  void svg.getBoundingClientRect()
  svg.classList.add('building')

  ticket.classList.add('pending')
  lines.forEach(li => li.classList.remove('in'))
  setMoney(total, 0)

  let shown = 0
  const tween = (from, to, ms) => {
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setMoney(total, from + (to - from) * e)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  ticketSteps.forEach((step, i) => {
    setTimeout(() => {
      lines[i]?.classList.add('in')
      const from = shown
      shown += step.add * QTY
      tween(from, shown, 520)
      if (i === ticketSteps.length - 1) setTimeout(() => ticket.classList.remove('pending'), 600)
    }, step.at)
  })
}

/* ------------------------------------------------------------------
   Try it: a cut-down calculator using the same price list and maths
   as the app (3 bottom boards 100 x 19 and 3 bearers 100 x 38).
   ------------------------------------------------------------------ */

function setupCalculator() {
  const $ = (id) => document.getElementById(id)
  const form = $('calc')
  if (!form) return

  const boards = []
  timberData.timberTypes.forEach(type => type.boardSizes.forEach(size => {
    boards.push({ ...size, id: `${type.id}:${size.id}`, label: `${type.shortName || type.name} ${size.width} × ${size.thickness}` })
  }))
  const select = $('c-board')
  select.innerHTML = boards.map(b => `<option value="${b.id}">${b.label}</option>`).join('')
  select.value = 'pine-green-case:100x17'

  const pine = timberData.timberTypes.find(t => t.id === 'pine-green-case')
  const bottomBoard = pine.boardSizes.find(s => s.id === '100x19')
  const bearer = pine.bearerSizes.find(s => s.id === '100x38')

  const plan = $('plan')

  const fill = (input) => {
    const min = +input.min, max = +input.max
    input.style.setProperty('--fill', `${((+input.value - min) / (max - min || 1)) * 100}%`)
  }

  const update = () => {
    const W = +$('c-width').value
    const L = +$('c-length').value
    const b = boards.find(x => x.id === select.value) || boards[0]
    const count = $('c-count')
    const max = Math.max(2, maxDeckBoards(W, b.width, null, 15))
    count.max = String(max)
    if (+count.value > max) count.value = String(max)
    const n = +count.value
    const qty = +$('c-qty').value

    const gap = deckGapSize(W, n, b.width)
    const each = timberCost(b.pricePerBoard, L, n) + timberCost(bottomBoard.pricePerBoard, L, 3) + timberCost(bearer.pricePerBearer, W, 3)

    $('o-width').textContent = `${W} mm`
    $('o-length').textContent = `${L} mm`
    $('o-count').textContent = String(n)
    $('o-qty').textContent = String(qty)
    $('r-gap').textContent = `${Math.round(gap * 10) / 10} mm`
    setMoney($('r-each'), each)
    setMoney($('r-total'), each * qty)
    $('r-total-label').textContent = qty === 1 ? 'Timber for 1 pallet' : `Timber for ${qty} pallets`
    form.querySelectorAll('input[type="range"]').forEach(fill)

    // Plan view of the top deck
    const s = 280 / Math.max(W, L)
    const pw = W * s, pl = L * s
    const x0 = (360 - pw) / 2, y0 = 44 + (300 - pl) / 2
    plan.innerHTML = ''
    const bearerZ = [0, (L - 38) / 2, L - 38]
    bearerZ.forEach(z => el('rect', { class: 'bearer', x: x0, y: y0 + z * s, width: pw, height: 38 * s }, plan))
    for (let i = 0; i < n; i++) {
      el('rect', { class: 'board', x: x0 + i * (b.width + gap) * s, y: y0, width: b.width * s, height: pl, rx: 1.5 }, plan)
    }
    const d = el('g', { class: 'dim' }, plan)
    el('line', { x1: x0, y1: y0 - 22, x2: x0 + pw, y2: y0 - 22 }, d)
    el('line', { x1: x0, y1: y0 - 30, x2: x0, y2: y0 - 6 }, d)
    el('line', { x1: x0 + pw, y1: y0 - 30, x2: x0 + pw, y2: y0 - 6 }, d)
    const t = el('text', { x: x0 + pw / 2, y: y0 - 28, 'text-anchor': 'middle' }, d)
    t.textContent = `${W}`
    el('line', { x1: x0 + pw + 18, y1: y0, x2: x0 + pw + 18, y2: y0 + pl }, d)
    el('line', { x1: x0 + pw + 10, y1: y0, x2: x0 + pw + 26, y2: y0 }, d)
    el('line', { x1: x0 + pw + 10, y1: y0 + pl, x2: x0 + pw + 26, y2: y0 + pl }, d)
    const tl = el('text', { x: x0 + pw + 30, y: y0 + pl / 2, 'text-anchor': 'middle', transform: `rotate(90 ${x0 + pw + 30} ${y0 + pl / 2})` }, d)
    tl.textContent = `${L}`
  }

  form.addEventListener('input', update)
  update()
}

/* ------------------------------------------------------------------ */

// Passages that differ depending on whether this build has accounts switched on
const accountsOn = Boolean(import.meta.env.VITE_SUPABASE_URL)
for (const node of document.querySelectorAll('[data-accounts]')) {
  if ((node.dataset.accounts === 'on') !== accountsOn) node.remove()
}

buildHero()
setMoney(document.getElementById('ticket-total'), ticketSteps.reduce((s, x) => s + x.add, 0) * QTY)
setupCalculator()

/* ------------------------------------------------------------------
   Motion
   ------------------------------------------------------------------ */

const seen = (node, fn, options) => {
  if (!node) return
  if (!('IntersectionObserver' in window)) { fn(node); return }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      io.unobserve(entry.target)
      fn(entry.target)
    }
  }, options)
  io.observe(node)
}

// Sections rise into place the first time they scroll into view
for (const node of document.querySelectorAll('[data-reveal]')) {
  if (reduceMotion) node.classList.add('in')
  else seen(node, (n) => n.classList.add('in'), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
}

// The pallet builds, and the ticket adds up, when the bento comes into view
const replay = document.getElementById('replay')
replay?.addEventListener('click', (e) => { e.preventDefault(); playHero() })
seen(document.getElementById('bento'), () => {
  if (document.fonts?.ready) document.fonts.ready.then(playHero)
  else playHero()
}, { threshold: 0.3 })

// Numbers count up from zero
for (const node of document.querySelectorAll('[data-count]')) {
  const target = +node.dataset.count
  if (reduceMotion || target === 0) continue
  node.textContent = '0'
  seen(node, () => {
    const start = performance.now()
    const ms = 500 + target * 160
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms)
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, { threshold: 0.6 })
}

// The app leans back as the page loads and stands up straight as you scroll
const app = document.getElementById('hero-app')
const frame = app?.querySelector('.app-frame')
if (frame && !reduceMotion) {
  let queued = false
  const lean = () => {
    queued = false
    const rect = app.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight * 0.75)))
    frame.style.setProperty('--tilt', `${(1 - p) * 14}deg`)
    frame.style.setProperty('--lift', `${(1 - p) * 30}px`)
  }
  lean()
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(lean) } }, { passive: true })
  window.addEventListener('resize', lean)
}

/* Hero video: a recording of the calculator in use, in the light or dark
   version to match the page. It plays muted on a loop while it is on
   screen. With reduced motion it stays on its poster and gets controls. */
const video = document.getElementById('hero-video')
if (video) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  let onScreen = true
  const play = () => { if (!reduceMotion && onScreen) video.play().catch(() => {}) }
  const load = () => {
    video.poster = dark.matches ? posterDark : posterLight
    // WebM where the browser can play it, MP4 everywhere else
    const webm = video.canPlayType('video/webm; codecs="vp9"') !== ''
    const mp4 = video.canPlayType('video/mp4; codecs="avc1.64001f"') !== ''
    video.src = dark.matches ? (mp4 || !webm ? demoDark : demoDarkWebm) : (mp4 || !webm ? demoLight : demoLightWebm)
    if (reduceMotion) video.controls = true
    else play()
  }
  load()
  dark.addEventListener?.('change', load)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) play()
      else video.pause()
    // Watch the wrapper, which doesn't move: the frame itself is tilted and animated
    }).observe(video.closest('.hero-app') || video)
  }
}

/* Steps: one open at a time, each showing its own screen. They advance
   on a timer while in view, until someone picks a step themselves. */
function setupSteps() {
  const list = document.getElementById('steps')
  const viewBox = document.getElementById('steps-view')
  if (!list || !viewBox) return
  const steps = [...list.querySelectorAll('.step')]
  const views = [...viewBox.querySelectorAll('.view')]
  const STEP_MS = 7000
  list.style.setProperty('--step-time', `${STEP_MS}ms`)
  let current = 0
  let timer = null
  let auto = !reduceMotion
  let visible = false

  const show = (i) => {
    current = (i + steps.length) % steps.length
    steps.forEach((step, n) => {
      step.classList.toggle('on', n === current)
      step.querySelector('.step-head').setAttribute('aria-expanded', String(n === current))
    })
    views.forEach((view, n) => view.classList.toggle('on', n === current))
  }

  const schedule = () => {
    clearTimeout(timer)
    list.classList.toggle('auto', auto && visible)
    if (auto && visible) timer = setTimeout(() => { show(current + 1); schedule() }, STEP_MS)
  }

  const pick = (i) => {
    auto = false
    show(i)
    schedule()
  }

  steps.forEach((step, i) => step.querySelector('.step-head').addEventListener('click', () => pick(i)))

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      // Restart the open step's timer line each time the section comes back into view
      if (visible && auto) show(current)
      schedule()
    }, { threshold: 0.35 }).observe(list)
  }

  // Bento cards jump to their step
  for (const link of document.querySelectorAll('a[data-step]')) {
    link.addEventListener('click', () => pick(+link.dataset.step))
  }
  // So do links straight to a step, such as #drawn
  const fromHash = () => {
    const i = steps.findIndex(step => step.id && `#${step.id}` === location.hash)
    if (i >= 0) pick(i)
  }
  window.addEventListener('hashchange', fromHash)
  fromHash()
}

setupSteps()
