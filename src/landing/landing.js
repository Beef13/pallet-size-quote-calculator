import '@fontsource-variable/outfit'
import './landing.css'
import { isDark, onThemeChange } from './theme'
import demoLight from './img/app-demo-light.mp4'
import demoDark from './img/app-demo-dark.mp4'
import demoLightWebm from './img/app-demo-light.webm'
import demoDarkWebm from './img/app-demo-dark.webm'
import posterLight from './img/app-demo-poster-light.webp'
import posterDark from './img/app-demo-poster-dark.webp'
import phoneLight from './img/app-demo-phone-light.mp4'
import phoneDark from './img/app-demo-phone-dark.mp4'
import phoneLightWebm from './img/app-demo-phone-light.webm'
import phoneDarkWebm from './img/app-demo-phone-dark.webm'
import phonePosterLight from './img/app-demo-phone-poster-light.webp'
import phonePosterDark from './img/app-demo-phone-poster-dark.webp'
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

/* The hero picture.
   Wide screens: the calculator itself, running in demonstration mode inside a frame.
   It is drawn at 1760 x 1100, a full desktop window, and scaled to fit, loads once the page is idle, and only
   takes clicks and scrolling after "Try it here" is pressed, so it never traps the
   page's own scrolling. It goes quiet again when it leaves the screen.
   Narrower screens: a recording of the calculator in use (phone-sized on phones),
   muted, looping while on screen, with a pause button; held on its poster for
   reduced motion. */
const video = document.getElementById('hero-video')
if (video) {
  const demo = video.parentElement
  const frame = document.getElementById('hero-app')
  const start = document.getElementById('demo-start')
  const toggle = document.getElementById('demo-toggle')
  const phone = window.matchMedia('(max-width: 560px)')
  const live = window.matchMedia('(min-width: 900px)')
  let onScreen = true
  // Paused by the visitor, or held on its poster because they asked for reduced motion
  let held = reduceMotion

  const sources = {
    wide: { light: [demoLight, demoLightWebm, posterLight], dark: [demoDark, demoDarkWebm, posterDark] },
    phone: { light: [phoneLight, phoneLightWebm, phonePosterLight], dark: [phoneDark, phoneDarkWebm, phonePosterDark] }
  }

  const showState = () => {
    if (!toggle) return
    const label = held ? 'Play the demonstration' : 'Pause the demonstration'
    toggle.toggleAttribute('data-paused', held)
    toggle.setAttribute('aria-label', label)
    toggle.title = held ? 'Play' : 'Pause'
  }
  const play = () => { if (!held && onScreen && !live.matches) video.play().catch(() => {}) }

  // The calculator: fetched once, when the page has finished loading and is idle
  let asked = false
  const fit = () => { frame.style.transform = `scale(${demo.clientWidth / 1760})` }
  const quiet = () => { demo.classList.remove('live'); frame.tabIndex = -1 }
  const loadApp = () => {
    if (asked || !frame) return
    asked = true
    frame.addEventListener('load', () => { demo.classList.add('loaded'); start.hidden = false }, { once: true })
    frame.hidden = false
    frame.src = `./app/index.html?demo=1&theme=${isDark() ? 'dark' : 'light'}`
    fit()
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(demo)
  }
  start?.addEventListener('click', () => {
    demo.classList.add('live')
    frame.tabIndex = 0
    frame.focus()
  })

  const load = () => {
    const [mp4Src, webmSrc, poster] = sources[phone.matches ? 'phone' : 'wide'][isDark() ? 'dark' : 'light']
    video.poster = poster
    demo.classList.toggle('with-app', live.matches && Boolean(frame))
    if (live.matches && frame) {
      // The poster stands in until the calculator is ready
      video.pause()
      video.removeAttribute('src')
      if (asked) frame.contentWindow?.postMessage({ type: 'pallet-theme', dark: isDark() }, window.location.origin)
      else if (document.readyState === 'complete') (window.requestIdleCallback || setTimeout)(loadApp)
      else window.addEventListener('load', () => (window.requestIdleCallback || setTimeout)(loadApp), { once: true })
      return
    }
    quiet()
    // MP4 wherever the browser can play it, WebM otherwise
    const webm = video.canPlayType('video/webm; codecs="vp9"') !== ''
    const mp4 = video.canPlayType('video/mp4; codecs="avc1.64001f"') !== ''
    video.src = mp4 || !webm ? mp4Src : webmSrc
    play()
  }

  toggle?.addEventListener('click', () => {
    held = !held
    if (held) video.pause()
    else play()
    showState()
  })

  load()
  showState()
  onThemeChange(load)
  phone.addEventListener?.('change', load)
  live.addEventListener?.('change', load)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) play()
      else { video.pause(); quiet() }
    }).observe(demo)
  }
}

/* ------------------------------------------------------------------
   Motion. Everything animates transform and opacity only, so it stays
   smooth, and all of it is skipped for people who ask for less motion.
   ------------------------------------------------------------------ */

// Sections rise into place the first time they come into view
const reveals = document.querySelectorAll('[data-reveal]')
if (reduceMotion || !('IntersectionObserver' in window)) {
  reveals.forEach(node => node.classList.add('in'))
} else {
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      seen.unobserve(entry.target)
      entry.target.classList.add('in')
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 })
  reveals.forEach(node => seen.observe(node))
}

// The top bar gains a backdrop once the page has scrolled, and the hero screenshot
// lifts and settles as it comes up the screen
const nav = document.getElementById('top')
const heroShot = document.getElementById('hero-shot')
const devices = document.querySelector('.devices')
let opened = false
let started = false
let queued = false
const onScroll = () => {
  queued = false
  nav?.classList.toggle('scrolled', window.scrollY > 12)
  if (heroShot && !reduceMotion) {
    const rect = heroShot.getBoundingClientRect()
    // 0 while the screenshot is low on the screen, 1 once its top reaches the upper third
    const p = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight * 0.85)))
    heroShot.style.setProperty('--rise', `${(1 - p) * 36}px`)
    heroShot.style.setProperty('--scale', String(0.965 + p * 0.035))
  }
  // The laptop opens as it comes up the screen, then the phone steps in beside it.
  // Once open it stays open, so the demonstration is never shut on someone using it.
  if (devices && !reduceMotion && !opened) {
    const top = devices.getBoundingClientRect().top
    const vh = window.innerHeight
    const p = Math.max(0, Math.min(1, (vh * 0.8 - top) / (vh * 0.6)))
    // Already well up the screen on arrival (a tall window): open it on a timer instead
    if (!started && p > 0.35) {
      opened = true
      devices.style.setProperty('--open', '0')
      devices.style.setProperty('--phone', '0')
      devices.classList.add('auto-open')
      setTimeout(() => {
        devices.style.setProperty('--open', '1')
        devices.style.setProperty('--phone', '1')
      }, 700)
      return
    }
    started = true
    const ease = (t) => 1 - Math.pow(1 - t, 3)
    const lid = ease(Math.min(1, p / 0.8))
    const phone = ease(Math.max(0, (p - 0.7) / 0.3))
    devices.style.setProperty('--open', lid.toFixed(3))
    devices.style.setProperty('--phone', phone.toFixed(3))
    if (p >= 1) opened = true
  }
}
window.addEventListener('scroll', () => {
  if (!queued) { queued = true; requestAnimationFrame(onScroll) }
}, { passive: true })
window.addEventListener('resize', onScroll)
onScroll()

/* How it works: on wide screens one screen stays in view while the steps scroll
   past it, changing to match the step nearest the middle of the window. */
const steps = [...document.querySelectorAll('.flow-step')]
const shots = [...document.querySelectorAll('.flow-shot')]
if (steps.length && 'IntersectionObserver' in window) {
  const show = (index) => {
    steps.forEach((step, i) => step.classList.toggle('on', i === index))
    shots.forEach((shot, i) => shot.classList.toggle('on', i === index))
  }
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) show(Number(entry.target.dataset.step))
    }
  }, { rootMargin: '-45% 0px -45% 0px' })
  steps.forEach(step => watcher.observe(step))
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
