import '@fontsource-variable/outfit'
import './landing.css'
import timberData from '../data/timber-prices.json'
import { deckGapSize, maxDeckBoards, timberCost, formatCurrency } from '../utils/calculations'
import { operator } from './operator'

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
   Hero: an isometric 1165 x 1165 pallet that assembles itself while
   the ticket adds up the price, part by part.
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

  // Isometric projection fitted to the 640 x 470 view box
  const C = Math.cos(Math.PI / 6), S = 0.5
  const raw = (x, y, z) => [(x - z) * C, (x + z) * S - y]
  // Sit the pallet up and to the left so the ticket can overlap the corner
  const k = Math.min(440 / ((W + L) * C), 300 / ((W + L) * S + H))
  const ox = 250 - ((W - L) * C * k) / 2
  const oy = 70 + H * k
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

// Pricing only appears once there is a payment link to send people to
const payLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK || ''
for (const node of document.querySelectorAll('[data-billing]')) {
  if ((node.dataset.billing === 'on') !== Boolean(payLink)) node.remove()
}
for (const node of document.querySelectorAll('[data-pay]')) node.href = payLink
for (const node of document.querySelectorAll('[data-interest]')) {
  node.href = `mailto:${operator.email}?subject=${encodeURIComponent('Pallet Quote for a team')}`
}

buildHero()
setMoney(document.getElementById('ticket-total'), ticketSteps.reduce((s, x) => s + x.add, 0) * QTY)
setupCalculator()

// Play the build once the fonts are in, so the ticket doesn't reflow mid-way
const start = () => playHero()
if (document.fonts?.ready) document.fonts.ready.then(start)
else start()

document.getElementById('replay')?.addEventListener('click', playHero)
