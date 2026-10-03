import '@fontsource-variable/outfit'
import './landing.css'
import './theme'
import { operator } from './operator'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const root = document.documentElement

// Passages that differ depending on whether this build has accounts switched on
const accountsOn = Boolean(import.meta.env.VITE_SUPABASE_URL)
root.classList.toggle('accounts-on', accountsOn)
for (const node of document.querySelectorAll('[data-accounts]')) {
  if ((node.dataset.accounts === 'on') !== accountsOn) node.remove()
}

// Plans and prices only appear once there is a payment link to send people to
const payLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK || ''
for (const node of document.querySelectorAll('[data-billing]')) {
  if ((node.dataset.billing === 'on') !== Boolean(payLink)) node.remove()
}
for (const node of document.querySelectorAll('[data-pay]')) node.href = payLink
for (const node of document.querySelectorAll('[data-interest]')) {
  node.href = `mailto:${operator.email}?subject=${encodeURIComponent('Pallet Quote for a team')}`
}

/* ------------------------------------------------------------------
   Motion. Everything animates transform and opacity only, so it stays
   smooth, and all of it is skipped for people who ask for less motion.
   ------------------------------------------------------------------ */

// Sections rise into place the first time they come into view. A group marked
// data-stagger brings its children in one after another instead.
const groups = document.querySelectorAll('[data-stagger]')
groups.forEach(group => [...group.children].forEach((child, i) => child.style.setProperty('--i', i)))

// The name in the footer comes up a letter at a time
for (const node of document.querySelectorAll('[data-letters]')) {
  const letters = [...node.textContent]
  node.textContent = ''
  letters.forEach((letter, i) => {
    const span = document.createElement('span')
    span.textContent = letter === ' ' ? '\u00a0' : letter
    span.style.setProperty('--i', i)
    node.append(span)
  })
}

const reveals = document.querySelectorAll('[data-reveal], [data-stagger], [data-letters]')
if (reduceMotion || !('IntersectionObserver' in window)) {
  reveals.forEach(node => node.classList.add('in'))
} else {
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      seen.unobserve(entry.target)
      entry.target.classList.add('in')
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 })
  reveals.forEach(node => seen.observe(node))
}

// On scroll: the top bar tightens into a floating pill, the hero screen tips
// upright as it comes up the window, and the large name behind it drifts
const nav = document.getElementById('top')
const hero = document.querySelector('.hero')
const heroShot = document.getElementById('hero-shot')
let queued = false
const onScroll = () => {
  queued = false
  nav?.classList.toggle('scrolled', window.scrollY > 12)
  // Back in the hero, no section is current
  if (window.scrollY < 300) document.querySelector('.nav-links [aria-current]')?.removeAttribute('aria-current')
  if (heroShot && !reduceMotion) {
    const rect = heroShot.getBoundingClientRect()
    if (rect.bottom > 0) {
      // 0 while the screen is low in the window, 1 once its top reaches the upper third
      const p = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight * 0.8)))
      heroShot.style.setProperty('--rise', `${(1 - p) * 24}px`)
      heroShot.style.setProperty('--scale', String(0.96 + p * 0.04))
      heroShot.style.setProperty('--tilt', `${(1 - p) * 16}deg`)
      hero.style.setProperty('--drift', `${window.scrollY * 0.14}px`)
    }
  }
}
window.addEventListener('scroll', () => {
  if (!queued) { queued = true; requestAnimationFrame(onScroll) }
}, { passive: true })
window.addEventListener('resize', onScroll)
onScroll()

// The link for the section being read is marked in the top bar
const links = [...document.querySelectorAll('.nav-links a')]
if (links.length && 'IntersectionObserver' in window) {
  const byId = new Map(links.map(link => [link.getAttribute('href').slice(1), link]))
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      links.forEach(link => link.removeAttribute('aria-current'))
      byId.get(entry.target.id)?.setAttribute('aria-current', 'true')
    }
  }, { rootMargin: '-40% 0px -55% 0px' })
  for (const id of byId.keys()) {
    const section = document.getElementById(id)
    if (section) spy.observe(section)
  }
}

/* Pointer effects, for devices with a mouse only. A soft light follows the
   pointer across the hero and across cards marked data-spot, and the sample
   pages marked data-tilt lean towards it. */
if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const track = (node, fn) => {
    let frame = 0
    node.addEventListener('pointermove', (event) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = node.getBoundingClientRect()
        fn((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
      })
    })
  }
  const light = (node) => track(node, (x, y) => {
    node.style.setProperty('--mx', `${x * 100}%`)
    node.style.setProperty('--my', `${y * 100}%`)
  })
  if (hero) light(hero)
  document.querySelectorAll('[data-spot]').forEach(light)
  for (const node of document.querySelectorAll('[data-tilt]')) {
    track(node, (x, y) => {
      node.style.setProperty('--ry', `${(x - 0.5) * 7}deg`)
      node.style.setProperty('--rx', `${(0.5 - y) * 5}deg`)
    })
    node.addEventListener('pointerleave', () => {
      node.style.setProperty('--ry', '0deg')
      node.style.setProperty('--rx', '0deg')
    })
  }
}

/* How it works: each step has a small panel showing just the part of the
   calculator it describes. On wide screens the panels are moved into one stage
   that stays in view while the steps scroll past; on narrow screens each stays
   under its step. A panel plays when its step reaches the middle of the window. */
const steps = [...document.querySelectorAll('.flow-step')]
const scenes = steps.map(step => step.querySelector('.scene'))
const stage = document.getElementById('flow-screen')

// Each panel holds one or more reels: frames captured from the real calculator, shown in turn
const timers = new WeakMap()
const frame = (reel, k) => {
  for (const img of reel.children) img.classList.toggle('show', Number(img.dataset.k) === k)
}
const last = (reel) => reel.dataset.times.split(',').length - 1
const settle = (reel) => {
  (timers.get(reel) || []).forEach(clearTimeout)
  frame(reel, last(reel))
}
const run = (reel) => {
  (timers.get(reel) || []).forEach(clearTimeout)
  frame(reel, 0)
  timers.set(reel, reel.dataset.times.split(',').slice(1).map((at, i) => setTimeout(() => frame(reel, i + 1), Number(at))))
}

if (steps.length && 'IntersectionObserver' in window) {
  let current = -1
  const show = (index) => {
    if (index === current) return
    current = index
    steps.forEach((step, i) => {
      step.classList.toggle('on', i === index)
      step.classList.toggle('done', i < index)
    })
    scenes.forEach((scene, i) => {
      if (!scene) return
      const on = i === index
      scene.classList.toggle('on', on)
      const reels = scene.querySelectorAll('.reel')
      if (on && !reduceMotion) reels.forEach(run)
      else reels.forEach(settle)
    })
  }

  // Wide: every panel lives in the stage. Narrow: each sits under its own step.
  const wide = window.matchMedia('(min-width: 901px)')
  const place = () => scenes.forEach((scene, i) => {
    if (scene) (wide.matches && stage ? stage : steps[i]).append(scene)
  })
  place()
  wide.addEventListener?.('change', place)

  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) show(Number(entry.target.dataset.step))
    }
  }, { rootMargin: '-45% 0px -45% 0px' })
  steps.forEach(step => watcher.observe(step))
  show(0)
}

/* Sample documents open in a popup over the page rather than a new tab.
   Without script, the links still open the PDFs directly. */
const viewer = document.getElementById('viewer')
if (viewer && typeof viewer.showModal === 'function') {
  const files = { customer: './sample-quote.pdf', breakdown: './sample-breakdown.pdf' }
  const tabs = [...viewer.querySelectorAll('[role="tab"]')]
  const pages = [...viewer.querySelectorAll('img[data-doc]')]
  const download = document.getElementById('viewer-dl')
  const body = document.getElementById('viewer-body')

  const show = (doc) => {
    tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.doc === doc)))
    pages.forEach(page => { page.hidden = page.dataset.doc !== doc })
    download.href = files[doc]
    body.scrollTop = 0
  }

  for (const link of document.querySelectorAll('a[data-doc]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      show(link.dataset.doc)
      viewer.showModal()
    })
  }
  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.doc)))
  document.getElementById('viewer-close').addEventListener('click', () => viewer.close())
  // A click on the dimmed area outside the sheet closes it; Escape does too
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close() })
}
