import '@fontsource-variable/outfit'
import './landing.css'
import timberData from '../data/timber-prices.json'
import { deckGapSize, maxDeckBoards, timberCost, formatCurrency } from '../utils/calculations'
import { setupWalkthrough } from './walkthrough'

const SVG_NS = 'http://www.w3.org/2000/svg'

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

setupCalculator()
setupWalkthrough()

