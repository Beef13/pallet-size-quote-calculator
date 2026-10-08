// The shorter landing page at /v2/. It shares the first page's styles and behaviour
// (theme, accounts and billing passages, the demo recording, reveals, the sample
// document viewer) and adds its own sections.
import './landing.js'
import './v2.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* "Pallet Quote ... while you ...": the middle line of each card steps through the
   jobs it does. The cards change one after another, not together, and only while
   they are on screen. With reduced motion the first line simply stays. */
const lines = [...document.querySelectorAll('[data-rotate]')]
if (lines.length && !reduceMotion) {
  const words = lines.map(line => line.dataset.rotate.split('|'))
  const at = lines.map(() => 0)
  let visible = false
  let turn = 0
  const grid = lines[0].closest('.while-grid')
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }).observe(grid)
  } else visible = true
  setInterval(() => {
    if (!visible || document.hidden) return
    const i = turn++ % lines.length
    const line = lines[i]
    at[i] = (at[i] + 1) % words[i].length
    line.classList.add('out')
    setTimeout(() => {
      line.textContent = words[i][at[i]]
      line.classList.remove('out')
    }, 260)
  }, 1100)
}

/* Features: one picture at a time, chosen from the list beside it */
const tabs = [...document.querySelectorAll('.tabs .tab')]
const choose = (tab, focus) => {
  for (const other of tabs) {
    const on = other === tab
    other.setAttribute('aria-selected', String(on))
    other.tabIndex = on ? 0 : -1
    document.getElementById(other.getAttribute('aria-controls')).hidden = !on
  }
  if (focus) tab.focus()
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => choose(tab))
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    choose(tabs[(i + step + tabs.length) % tabs.length], true)
  })
})
