/* ------------------------------------------------------------------
   Walkthrough: one enquiry, start to finish, driven by the scroll
   position. A small working model of the app sits pinned beside the
   steps; scrolling scrubs it forwards and backwards.

   Everything shown is worked out with the app's own price list and
   maths, so the figures match what the calculator would give.
   ------------------------------------------------------------------ */

import './walkthrough.css'
import timberData from '../data/timber-prices.json'
import { deckGapSize, maxDeckBoards, timberCost, costStack, orderTotals, formatCurrency } from '../utils/calculations'

const SVG_NS = 'http://www.w3.org/2000/svg'

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (parent) parent.appendChild(node)
  return node
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (a, b, x) => clamp((x - a) / (b - a))
const ease = (x) => 1 - Math.pow(1 - x, 3)
const lerp = (a, b, p) => a + (b - a) * p

function money(value) {
  const [whole, cents] = formatCurrency(value).split('.')
  return `${whole}<span class="cents">.${cents}</span>`
}

// The enquiry being quoted
const W = 1165, L = 1165, QTY = 250
const BOARD_W = 100, TOP_T = 17, BOTTOM_T = 19, BEARER_H = 100, BEARER_T = 38
const BASE_TOP = 7, PEAK_TOP = 9
const LABOUR = 3, MARKUP = 25
const STEPS = 6
const CALL_SECONDS = 120

const pine = timberData.timberTypes.find(t => t.id === 'pine-green-case')
const topBoard = pine.boardSizes.find(s => s.id === '100x17')
const bottomBoard = pine.boardSizes.find(s => s.id === '100x19')
const bearer = pine.bearerSizes.find(s => s.id === '100x38')

const MAX_TOP = maxDeckBoards(W, BOARD_W, null, 15)
const bottomCost = timberCost(bottomBoard.pricePerBoard, L, 3)
const bearerCost = timberCost(bearer.pricePerBearer, W, 3)
const topCostFor = (n) => timberCost(topBoard.pricePerBoard, L, n)
const materials = bottomCost + bearerCost + topCostFor(BASE_TOP)
const stack = costStack(materials, { labourPerPallet: LABOUR, markupPercent: MARKUP })
const totals = orderTotals(stack.sellPerPallet, QTY)

export function setupWalkthrough() {
  const stage = document.getElementById('stage')
  const steps = [...document.querySelectorAll('.walk-step')]
  if (!stage || steps.length !== STEPS) return

  const $ = (sel) => stage.querySelector(sel)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------- Build the pallet once; each part is moved by transforms ---------- */

  const svg = $('.stage-pallet')
  const C = Math.cos(Math.PI / 6), S = 0.5
  const y0 = BOTTOM_T, y1 = BOTTOM_T + BEARER_H, H = y1 + TOP_T
  const k = Math.min(470 / ((W + L) * C), 300 / ((W + L) * S + H))
  const ox = 62 + L * C * k, oy = 300 + H * k
  const P = (x, y, z) => [ox + (x - z) * C * k, oy + ((x + z) * S - y) * k]
  const pts = (...p) => p.map(q => q.map(n => n.toFixed(2)).join(',')).join(' ')
  // Sliding a part along the pallet's width moves it this far on screen
  const slide = (dx) => [dx * C * k, dx * S * k]

  el('polygon', { class: 'shadow-blob', points: pts(P(-30, 0, -30), P(W + 30, 0, -30), P(W + 30, 0, L + 30), P(-30, 0, L + 30)) }, svg)
  const shadow = svg.querySelector('.shadow-blob')
  const outline = el('polygon', { class: 'footprint', pathLength: 1, points: pts(P(0, 0, 0), P(W, 0, 0), P(W, 0, L), P(0, 0, L)) }, svg)

  const box = (b, cls, parent) => {
    const g = el('g', { class: `part ${cls}` }, parent)
    el('polygon', { class: 'face-left', points: pts(P(b.x0, b.y0, b.z1), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)) }, g)
    el('polygon', { class: 'face-right', points: pts(P(b.x1, b.y0, b.z0), P(b.x1, b.y0, b.z1), P(b.x1, b.y1, b.z1), P(b.x1, b.y1, b.z0)) }, g)
    el('polygon', { class: 'face-top', points: pts(P(b.x0, b.y1, b.z0), P(b.x1, b.y1, b.z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)) }, g)
    return g
  }

  const place = (g, dx, e) => {
    const [sx, sy] = slide(dx)
    g.style.transform = `translate(${sx.toFixed(2)}px, ${(sy - (1 - e) * 44).toFixed(2)}px)`
    g.style.opacity = e.toFixed(3)
  }

  const bottomGap = deckGapSize(W, 3, BOARD_W)
  const bottoms = [0, 1, 2].map(i => ({ g: box({ x0: 0, x1: BOARD_W, y0: 0, y1: BOTTOM_T, z0: 0, z1: L }, 'board', svg), x: i * (BOARD_W + bottomGap) }))
  const bearerZ = [0, (L - BEARER_T) / 2, L - BEARER_T]
  const bearers = bearerZ.map(z => ({ g: box({ x0: 0, x1: W, y0, y1, z0: z, z1: z + BEARER_T }, 'bearer', svg) }))

  // Top boards: enough for the fullest deck. Each one remembers where it is, so a change
  // of count re-spaces them smoothly rather than jumping.
  const tops = Array.from({ length: MAX_TOP }, (_, i) => {
    const g = box({ x0: 0, x1: BOARD_W, y0: y1, y1: y1 + TOP_T, z0: 0, z1: L }, 'board', svg)
    bearerZ.forEach(z => [0.25, 0.75].forEach(f => {
      const [cx, cy] = P(BOARD_W * f, y1 + TOP_T, z + BEARER_T / 2)
      el('ellipse', { class: 'nail', cx, cy, rx: 1.5, ry: 0.9 }, g)
    }))
    return { g, x: i * (BOARD_W + deckGapSize(W, BASE_TOP, BOARD_W)), e: 0 }
  })

  // Overall dimensions along the two near edges
  const dims = el('g', { class: 'dim stage-dims' }, svg)
  const dim = (a, b, label) => {
    const [ax, ay] = P(...a.from), [bx, by] = P(...b.from)
    const [oxA, oyA] = P(...a.to), [oxB, oyB] = P(...b.to)
    el('line', { x1: ax, y1: ay, x2: oxA, y2: oyA }, dims)
    el('line', { x1: bx, y1: by, x2: oxB, y2: oyB }, dims)
    el('line', { x1: oxA, y1: oyA, x2: oxB, y2: oyB }, dims)
    for (const [tx, ty] of [[oxA, oyA], [oxB, oyB]]) el('path', { d: `M${tx - 4} ${ty + 4} L${tx + 4} ${ty - 4}` }, dims)
    const mx = (oxA + oxB) / 2, my = (oyA + oyB) / 2
    const ang = Math.atan2(oyB - oyA, oxB - oxA) * 180 / Math.PI
    const upright = ang > 90 || ang < -90 ? ang + 180 : ang
    el('text', { x: mx, y: my - 8, 'text-anchor': 'middle', transform: `rotate(${upright} ${mx} ${my})` }, dims).textContent = label
  }
  const off = 150
  dim({ from: [0, 0, L], to: [0, 0, L + off] }, { from: [W, 0, L], to: [W, 0, L + off] }, String(W))
  dim({ from: [W, 0, 0], to: [W + off, 0, 0] }, { from: [W, 0, L], to: [W + off, 0, L] }, String(L))

  // Gap between the first two top boards, called out above the back edge
  const gapNote = el('g', { class: 'gap-note' }, svg)
  const gapLead = el('line', {}, gapNote)
  const gapPlate = el('rect', { rx: 11, height: 22 }, gapNote)
  const gapText = el('text', { 'text-anchor': 'middle' }, gapNote)

  /* ---------- Handles on the rest of the stage ---------- */

  const rows = [...stage.querySelectorAll('.stage-row')]
  const rowParts = rows.map(row => ({
    row,
    summary: row.querySelector('.stage-row-summary'),
    cost: row.querySelector('.stage-cost'),
    ring: row.querySelector('.ring-progress')
  }))
  const RING = 2 * Math.PI * 8

  const setRow = (i, ratio, summary, cost) => {
    const r = rowParts[i]
    r.row.classList.toggle('done', ratio >= 0.999)
    r.row.classList.toggle('todo', ratio <= 0)
    r.ring.style.strokeDashoffset = (RING * (1 - clamp(ratio))).toFixed(2)
    if (r.summary.textContent !== summary) r.summary.textContent = summary
    if (r.cost) {
      r.cost.hidden = !(cost > 0)
      const text = formatCurrency(cost)
      if (r.cost.textContent !== text) r.cost.textContent = text
    }
  }

  const sliderRow = $('.stage-slider')
  const sliderCount = $('.stage-slider-count')
  const sliderFill = $('.stage-slider-fill')
  const sliderThumb = $('.stage-slider-thumb')
  const card = $('.stage-card')
  const cardLabel = $('.stage-card-label')
  const cardValue = $('.stage-card-value')
  const cardLines = [...stage.querySelectorAll('.stage-card-lines li')]
  const body = $('.stage-body')
  const pin = stage.closest('.walk-pin')
  const sheets = $('.stage-sheets')
  const sheetFront = $('.sheet-customer')
  const sheetBack = $('.sheet-yours')
  const callPill = $('.stage-call')
  const callTime = $('.stage-call-time')
  const callLabel = $('.stage-call-label')
  const tag = $('.stage-tag')

  // Figures that never change during the walkthrough
  const fill = (sel, html) => stage.querySelectorAll(sel).forEach(n => { n.innerHTML = html })
  fill('[data-v="labour"]', money(stack.labourPerPallet))
  fill('[data-v="markup"]', money(stack.markupPerPallet))
  fill('[data-v="markup-pct"]', `${MARKUP}%`)
  fill('[data-v="margin-pct"]', `${Math.round(stack.marginPercent)}%`)
  fill('[data-v="each"]', money(stack.sellPerPallet))
  fill('[data-v="qty"]', String(QTY))
  fill('[data-v="ex"]', money(totals.exGst))
  fill('[data-v="gst"]', money(totals.gst))
  fill('[data-v="grand"]', money(totals.grand))
  fill('[data-v="materials"]', money(materials))
  fill('[data-v="bottom"]', money(bottomCost))
  fill('[data-v="bearers"]', money(bearerCost))
  fill('[data-v="top"]', money(topCostFor(BASE_TOP)))
  fill('[data-v="profit"]', money(stack.markupPerPallet * QTY))

  let stageW = 0, stageH = 0
  const view = $('.stage-view')
  const measure = () => {
    stageW = body.clientWidth; stageH = body.clientHeight
    // A tall view leaves room above the pallet for the price card; a wide one crops in on the pallet
    const wide = view.clientWidth / Math.max(1, view.clientHeight) > 1.15
    svg.setAttribute('viewBox', wide ? '0 250 600 400' : '0 0 600 700')
  }
  new ResizeObserver(() => { measure(); wake() }).observe(body)
  measure()

  /* ---------- Draw one moment of the story (t runs from 0 to 6) ---------- */

  let lastCount = BASE_TOP

  function draw(t, dt) {
    // 0: the size is typed and the footprint is drawn
    const digits = (a, b) => Math.round(4 * seg(a, b, t))
    const wDigits = digits(0.1, 0.34), lDigits = digits(0.4, 0.64)
    const typed = (n, full) => (n === 0 ? '' : String(full).slice(0, n))
    const sizeText = wDigits === 0 ? 'Not set' : `${typed(wDigits, W)}${lDigits ? ` × ${typed(lDigits, L)}` : ''}${lDigits === 4 ? ' mm' : ''}`
    setRow(0, (wDigits + lDigits) / 8, sizeText)

    outline.style.strokeDashoffset = (1 - ease(seg(0.5, 0.95, t))).toFixed(3)
    outline.style.opacity = lerp(1, 0.25, seg(1.0, 1.3, t)).toFixed(3)
    dims.style.opacity = ease(seg(0.72, 1.0, t)).toFixed(3)

    // 1: timber for each part, dropping in as it is chosen
    let bottomIn = 0
    bottoms.forEach((b, i) => { const e = ease(seg(1.04 + i * 0.06, 1.16 + i * 0.06, t)); bottomIn += e / 3; place(b.g, b.x, e) })
    shadow.style.opacity = bottomIn.toFixed(3)
    let bearerIn = 0
    bearers.forEach((b, i) => { const e = ease(seg(1.34 + i * 0.06, 1.46 + i * 0.06, t)); bearerIn += e / 3; place(b.g, 0, e) })

    // 2: the deck goes from seven boards to nine and back, re-spacing itself
    const sliderAt = BASE_TOP + (PEAK_TOP - BASE_TOP) * (ease(seg(2.12, 2.42, t)) - ease(seg(2.58, 2.88, t)))
    const count = Math.round(sliderAt)
    const gapTarget = deckGapSize(W, count, BOARD_W)
    const follow = reduceMotion ? 1 : 1 - Math.exp(-dt / 90)
    let topIn = 0
    tops.forEach((b, i) => {
      const landed = i < BASE_TOP ? ease(seg(1.62 + i * 0.045, 1.74 + i * 0.045, t)) : null
      const want = landed === null ? (i < count ? 1 : 0) : landed
      b.e = landed === null ? lerp(b.e, want, follow) : want
      b.x = lerp(b.x, Math.min(i, count - 1) * (BOARD_W + gapTarget), follow)
      if (i < BASE_TOP) topIn += b.e / BASE_TOP
      place(b.g, b.x, b.e)
    })
    if (count !== lastCount) lastCount = count

    const topCost = topCostFor(count) * topIn
    setRow(1, bottomIn, bottomIn > 0 ? '3 × 100 × 19 green case pine' : 'Not chosen', bottomCost * bottomIn)
    setRow(2, bearerIn, bearerIn > 0 ? '3 × 100 × 38 green case pine' : 'Not chosen', bearerCost * bearerIn)
    setRow(3, topIn, topIn > 0 ? `${count} × 100 × 17 green case pine` : 'Not chosen', topCost)

    const sliderOn = seg(1.9, 2.05, t)
    sliderRow.style.opacity = lerp(0.35, 1, sliderOn).toFixed(3)
    sliderRow.classList.toggle('live', t >= 2 && t < 3)
    const pct = ((sliderAt - 2) / (MAX_TOP - 2)) * 100
    sliderFill.style.width = `${pct.toFixed(2)}%`
    sliderThumb.style.left = `${pct.toFixed(2)}%`
    const countText = `${count} of ${MAX_TOP}`
    if (sliderCount.textContent !== countText) sliderCount.textContent = countText

    // Gap call-out follows the boards as they move
    const liveGap = tops[1].x - BOARD_W
    const [gx, gy] = P(BOARD_W + liveGap / 2, H, 0)
    const noteOn = ease(seg(1.9, 2.05, t)) * (1 - seg(3.0, 3.15, t))
    gapNote.style.opacity = noteOn.toFixed(3)
    const label = `${(Math.round(gapTarget * 10) / 10).toString()} mm gaps`
    if (gapText.textContent !== label) gapText.textContent = label
    const plateW = 96
    gapLead.setAttribute('x1', gx); gapLead.setAttribute('y1', gy - 3)
    gapLead.setAttribute('x2', gx); gapLead.setAttribute('y2', gy - 30)
    gapPlate.setAttribute('x', gx - plateW / 2); gapPlate.setAttribute('y', gy - 52); gapPlate.setAttribute('width', plateW)
    gapText.setAttribute('x', gx); gapText.setAttribute('y', gy - 37)

    // 3: labour, markup, quantity and GST stack up into the price
    const timber = bottomCost * bottomIn + bearerCost * bearerIn + topCost
    const a = seg(3.08, 3.28, t), b = seg(3.3, 3.5, t), c = seg(3.55, 3.78, t), d = seg(3.8, 3.97, t)
    const reveal = [a, b, c, d]
    cardLines.forEach((li, i) => {
      const e = ease(reveal[i])
      li.style.height = `${(e * 28).toFixed(2)}px`
      li.style.opacity = e.toFixed(3)
    })
    let value = timber + stack.labourPerPallet * ease(a) + stack.markupPerPallet * ease(b)
    let labelText = a > 0 ? 'Price per pallet' : 'Timber per pallet'
    if (c > 0) { value = lerp(stack.sellPerPallet, totals.exGst, ease(c)); labelText = `${QTY} pallets ex GST` }
    if (d > 0) { value = totals.exGst + totals.gst * ease(d); labelText = `${QTY} pallets inc GST` }
    if (cardLabel.textContent !== labelText) cardLabel.textContent = labelText
    cardValue.innerHTML = money(value)
    card.classList.toggle('open', a > 0)

    // 4 and 5: the drawing arrives as a sheet, then pulls back to show both PDFs
    const enter = ease(seg(4.04, 4.42, t))
    const out = ease(seg(5.04, 5.4, t))
    const back = ease(seg(5.22, 5.58, t))
    sheets.style.visibility = enter > 0 ? 'visible' : 'hidden'
    body.style.setProperty('--dim', (1 - enter * 0.86).toFixed(3))

    const sw = stageW, sh = stageH
    const close = Math.min((sw * 0.94) / 378, (sh * 0.94) / 354)
    const far = Math.min((sh * 0.92) / 594, (sw * 0.45) / 420)
    const s = lerp(close, far, out)
    const tx = lerp(sw / 2 - 210 * close, sw * 0.26 - 210 * far, out)
    const ty = lerp(sh / 2 - 231 * close, sh / 2 - 297 * far, out) + (1 - enter) * sh * 1.08
    sheetFront.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`
    const bx = sw * 0.26 - 210 * far + back * sw * 0.48
    const by = sh / 2 - 297 * far + back * 6
    sheetBack.style.transform = `translate(${bx.toFixed(2)}px, ${by.toFixed(2)}px) scale(${far.toFixed(4)}) rotate(${(back * 1.2).toFixed(2)}deg)`
    sheetBack.style.opacity = seg(5.2, 5.32, t).toFixed(3)
    sheets.classList.toggle('pair', back > 0.6)

    // The call clock and the quote's status
    const sent = t >= 5.66
    const seconds = Math.round(clamp(t / 5.66) * CALL_SECONDS)
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    if (callTime.textContent !== clock) callTime.textContent = clock
    callPill.classList.toggle('sent', sent)
    const callText = sent ? 'Quote sent at' : 'On the phone'
    if (callLabel.textContent !== callText) callLabel.textContent = callText
    tag.classList.toggle('sent', sent)
    const tagText = sent ? 'Sent' : 'Draft'
    if (tag.textContent !== tagText) tag.textContent = tagText

    // Which control the story is on (drives the compact layout on phones)
    const focus = t < 1 ? 0 : t < 1.3 ? 1 : t < 1.6 ? 2 : 3
    rows.forEach((row, i) => row.classList.toggle('focus', i === focus))
  }

  /* ---------- Follow the scroll ---------- */

  let target = 0, shown = 0, last = 0, running = false, active = -1

  function readScroll() {
    // Desktop: a step plays as it crosses the middle of the window. Phone: it plays while its
    // words are held under the pinned stage.
    const narrow = window.innerWidth <= 960
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
    shown = reduceMotion || Math.abs(gap) < 0.0005 ? target : shown + gap * (1 - Math.exp(-dt / 110))
    draw(shown, dt)
    const settling = tops.some((b, i) => i >= BASE_TOP && b.e > 0.001 && b.e < 0.999) ||
      Math.abs(tops[1].x - (BOARD_W + deckGapSize(W, lastCount, BOARD_W))) > 0.05
    if (shown !== target || settling) requestAnimationFrame(frame)
    else running = false
  }

  function wake() {
    if (running) return
    running = true
    last = performance.now()
    requestAnimationFrame(frame)
  }

  window.addEventListener('scroll', readScroll, { passive: true })
  window.addEventListener('resize', readScroll)
  stage.classList.add('ready')
  readScroll()
}
