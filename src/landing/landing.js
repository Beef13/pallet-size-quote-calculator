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
// The founding offer goes to the same monthly checkout with its promo code already entered
// (Stripe payment links read `prefilled_promo_code`; the link must allow promotion codes)
const foundingLink = payLink && `${payLink}${payLink.includes('?') ? '&' : '?'}prefilled_promo_code=FOUNDING`
for (const node of document.querySelectorAll('[data-pay-founding]')) node.href = foundingLink
// The yearly price is optional: with no yearly link, the page only mentions the monthly price
const payLinkYearly = import.meta.env.VITE_STRIPE_PAYMENT_LINK_YEARLY || ''
for (const node of document.querySelectorAll('[data-pay-yearly]')) {
  if (payLinkYearly) node.href = payLinkYearly
  else node.remove()
}
if (!payLinkYearly) for (const node of document.querySelectorAll('[data-pay-yearly-text]')) node.remove()
for (const node of document.querySelectorAll('[data-interest]')) {
  node.href = `mailto:${operator.email}?subject=${encodeURIComponent('Custom Pallet Quote for our business')}`
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
  // The phone beside the laptop: its picture is replaced by the calculator at phone
  // size the first time the demonstration is started
  const handset = document.querySelector('.handset')
  const phoneFrame = document.getElementById('hero-phone-app')
  const phoneLive = phoneFrame?.parentElement
  const phoneBand = () => { if (phoneLive) phoneLive.style.background = isDark() ? '#0e1011' : '#ececee' }
  const fitPhone = () => { phoneFrame.style.transform = `scale(${phoneLive.clientWidth / 390})` }
  let phoneAsked = false
  const loadPhone = () => {
    if (phoneAsked || !phoneFrame || !handset.offsetParent) return
    phoneAsked = true
    phoneBand()
    phoneFrame.addEventListener('load', () => setTimeout(() => handset.classList.add('loaded'), 600), { once: true })
    phoneFrame.hidden = false
    phoneFrame.src = `./app/index.html?demo=1&tab=quote&theme=${isDark() ? 'dark' : 'light'}`
    fitPhone()
    if ('ResizeObserver' in window) new ResizeObserver(fitPhone).observe(phoneLive)
  }
  start?.addEventListener('click', () => {
    demo.classList.add('live')
    frame.tabIndex = 0
    frame.focus()
    loadPhone()
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
      if (phoneAsked) { phoneBand(); phoneFrame.contentWindow?.postMessage({ type: 'pallet-theme', dark: isDark() }, window.location.origin) }
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
let queued = false

/* The laptop as a 3D model: wide screens with WebGL, and not for reduced motion.
   It starts shut, seen from above; the first stretch of scrolling opens it and brings
   the view round to the front, then the working calculator takes over its display
   and the phone steps in. It runs both ways with the scroll until someone starts the
   demonstration, then it stays open. Everything is loaded on demand; if any of it
   fails, the drawn mockup stays. */
const devices = document.querySelector('.devices')
const stage = devices?.querySelector('.laptop')
const lidBox = devices?.querySelector('.laptop-lid')
let model = null
let home = null
let latched = false
const clamp01 = (v) => Math.max(0, Math.min(1, v))
// Where the laptop sits on the page, and the pause. Once the laptop is open the hero is
// held in place for half a window of scrolling, long enough to notice the demonstration
// and try it, then the page carries on. The hero is held by sticking it where it is
// at that moment; the space for the pause is added below it.
const pin = document.querySelector('.hero-pin')
const heroEl = pin?.querySelector('.hero')
// How far the page has scrolled when the laptop is fully open: the point at which the
// whole laptop, lid to base, sits in the middle of the window below the top bar
let screenBox = null
const openPoint = () => {
  const vh = window.innerHeight
  if (!screenBox) return Math.max(home - vh * 0.14, vh * 0.5)
  const tall = screenBox.ground.y - screenBox.top + 14
  const lidTop = Math.max(76, (vh - tall) / 2 + 52)
  return Math.max(home + screenBox.top - lidTop, vh * 0.35)
}
const measure = () => {
  const pinTop = pin ? pin.getBoundingClientRect().top + window.scrollY : 0
  // Measured through the layout, not from where things are drawn, so the hero's own
  // entrance and scroll movement cannot throw it off
  let within = 0
  for (let node = devices; node && node !== heroEl; node = node.offsetParent) within += node.offsetTop
  home = pinTop + within
  if (!pin || home < window.innerHeight * 0.3) return
  heroEl.style.top = `${Math.round(pinTop - openPoint())}px`
  pin.style.setProperty('--hold', `${Math.round(window.innerHeight * 0.5)}px`)
  pin.classList.add('holds')
}
const showAt = (p) => {
  model.pose(p)
  devices.classList.toggle('is-open', p >= 0.995)
  devices.style.setProperty('--p', p.toFixed(3))
  const t = clamp01((p - 0.86) / 0.14)
  devices.style.setProperty('--phone', (1 - Math.pow(1 - t, 3)).toFixed(3))
}
const placeScreen = () => {
  const box = model.openRect()
  screenBox = box
  lidBox.style.left = `${box.left}px`
  lidBox.style.top = `${box.top}px`
  lidBox.style.width = `${box.width}px`
  lidBox.style.height = `${box.height}px`
  lidBox.style.setProperty('--screen-radius', `${box.radius}px`)
  stage.style.setProperty('--ground-y', `${box.ground.y}px`)
  stage.style.setProperty('--base-left', `${box.ground.left}px`)
  stage.style.setProperty('--base-width', `${box.ground.width}px`)
}
const canModel = () => {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch { return false }
}
if (stage && lidBox && !reduceMotion && window.matchMedia('(min-width: 900px)').matches && canModel()) {
  devices.classList.add('model-pending')
  const fallBack = () => { if (!model) devices.classList.remove('model-pending') }
  const giveUp = setTimeout(fallBack, 8000)
  import('./hero3d.js')
    .then(({ mountLaptop }) => mountLaptop({ stage, dark: isDark() }))
    .then((api) => {
      clearTimeout(giveUp)
      model = api
      devices.classList.add('model-pending')
      devices.classList.replace('model-pending', 'model')
      placeScreen()
      onThemeChange(() => api.setDark(isDark()))
      if ('ResizeObserver' in window) new ResizeObserver(() => { api.resize(); placeScreen(); measure() }).observe(stage)
      measure()
      window.addEventListener('resize', measure)
      // A window tall enough to show it all on arrival: play it through on a timer
      if (home < window.innerHeight * 0.3) {
        latched = true
        const began = performance.now() + 600
        const step = (now) => {
          const t = clamp01((now - began) / 2400)
          showAt(t)
          if (t < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      } else onScroll()
    })
    .catch(() => { clearTimeout(giveUp); fallBack() })
}
/* The phone in "Quote from anywhere": a 3D model whose spin is tied to the scroll.
   As the section comes up the screen the phone spins up into place, forwards or back
   with the scroll. When it has landed the panel holds still in the middle of the window,
   and scrolling on brings the callouts in one after another; then the page carries on.
   Wide screens with WebGL only, and not for reduced motion; otherwise the plain
   picture of the phone stays, with the callouts beside it. */
const phoneStage = document.getElementById('anywhere-stage')
let scrubPhone = null
if (phoneStage && !reduceMotion && 'IntersectionObserver' in window &&
    window.matchMedia('(min-width: 900px)').matches && canModel()) {
  const section = document.getElementById('anywhere')
  const panel = section.querySelector('.anywhere-panel')
  const scene = phoneStage.parentElement
  const notes = [...scene.querySelectorAll('.note')]
  // The order they arrive in: top left, top right, lower left, lower right
  const turn = [0, 2, 1, 3]
  let phone = null
  let stickAt = 0   // how far the page has scrolled when the panel starts to hold
  let hold = 0
  let approach = 0

  const layout = () => {
    const vh = window.innerHeight
    let top = 0
    for (let node = section; node; node = node.offsetParent) top += node.offsetTop
    const panelTop = top + parseFloat(getComputedStyle(section).paddingTop)
    // Held with the whole panel in view under the top bar where it fits; otherwise
    // with the phone in the middle of the window
    const stuck = panel.offsetHeight <= vh - 84
      ? 72 + (vh - 72 - panel.offsetHeight) / 2
      : vh / 2 - (scene.offsetTop + scene.offsetHeight / 2)
    hold = Math.round(vh * 0.9)
    approach = vh * 0.55
    stickAt = panelTop - stuck
    panel.style.top = `${Math.round(stuck)}px`
    section.style.setProperty('--hold', `${hold}px`)
    section.classList.add('holds')
  }

  // One sequence, all of it tied to the scroll and closely overlapped: the heading
  // rises in, the line under it follows, and the phone is already spinning up as they
  // settle; the callouts follow during the hold
  const part = (v, from, to) => clamp01((v - from) / (to - from))
  const soft = (t) => t * t * (3 - 2 * t)
  scrubPhone = () => {
    const y = window.scrollY
    const coming = clamp01((y - (stickAt - approach)) / approach)
    panel.style.setProperty('--title', soft(part(coming, 0, 0.32)).toFixed(3))
    // "anytime" comes after a beat, like a word said after a pause
    panel.style.setProperty('--title2', soft(part(coming, 0.46, 0.68)).toFixed(3))
    panel.style.setProperty('--intro', soft(part(coming, 0.6, 0.92)).toFixed(3))
    if (!phone) return
    phone.pose(part(coming, 0.1, 1))
    const through = clamp01((y - stickAt) / hold)
    notes.forEach((note, i) => note.classList.toggle('on', through > 0.08 + turn[i] * 0.2))
  }

  // The plain picture steps aside while the model is on its way
  phoneStage.classList.add('model')
  panel.classList.add('scrub')
  layout()
  if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); scrubPhone() }).observe(document.body)
  window.addEventListener('resize', () => { layout(); scrubPhone() })
  scrubPhone()
  const near = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return
    near.disconnect()
    import('./phone3d.js')
      .then(({ mountPhone }) => mountPhone({ stage: phoneStage, dark: isDark() }))
      .then((api) => {
        phone = api
        scene.classList.add('scrub')
        layout()
        onThemeChange(() => api.setDark(isDark()))
        if ('ResizeObserver' in window) new ResizeObserver(() => api.resize()).observe(phoneStage)
        scrubPhone()
      })
      .catch(() => phoneStage.classList.remove('model'))
  }, { rootMargin: '1400px 0px' })
  near.observe(phoneStage)
}

const onScroll = () => {
  queued = false
  nav?.classList.toggle('scrolled', window.scrollY > 12)
  scrubPhone?.()
  if (heroShot && !reduceMotion) {
    const rect = heroShot.getBoundingClientRect()
    // 0 while the screenshot is low on the screen, 1 once its top reaches the upper third
    const p = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight * 0.85)))
    heroShot.style.setProperty('--rise', `${(1 - p) * 36}px`)
    heroShot.style.setProperty('--scale', String(0.965 + p * 0.035))
  }
  if (model && !latched) {
    if (devices.querySelector('.demo.live')) { latched = true; showAt(1); return }
    const vh = window.innerHeight
    showAt(clamp01(window.scrollY / openPoint()))
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

/* The demonstration at full size. A pill by each screen opens it; the screen grows
   from where it sits on the page into a window of its own (the laptop's into one nearly
   the size of the display, the phone's into a phone at real size) while the page dims
   and blurs behind. A switch at the top changes between the two. Closing shrinks it
   back to where it came from. These are their own copies of the calculator, loaded
   the first time each is opened. */
const expand = document.getElementById('expand')
if (expand && devices && typeof expand.showModal === 'function') {
  const openers = [...devices.querySelectorAll('.expand-open')]
  const views = Object.fromEntries([...expand.querySelectorAll('.expand-view')].map(v => [v.dataset.kind, v]))
  const tabs = [...expand.querySelectorAll('[role="tab"]')]
  const stageEl = document.getElementById('expand-stage')
  const sources = { desktop: () => devices.querySelector('.laptop-lid'), mobile: () => devices.querySelector('.handset-live') }
  const address = { desktop: './app/index.html?demo=1&zoom=1', mobile: './app/index.html?demo=1&zoom=1&tab=quote' }
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
  let current = 'desktop'
  let busy = false

  // The pill sits above the middle of the laptop's screen, clear of the lid
  const place = () => {
    const base = devices.getBoundingClientRect()
    for (const opener of openers) {
      const box = sources[opener.dataset.kind]().getBoundingClientRect()
      opener.style.left = `${box.left + box.width / 2 - base.left - opener.offsetWidth / 2}px`
      opener.style.top = `${box.top - base.top - opener.offsetHeight - 36}px`
    }
  }
  const reveal = () => { openers.forEach(o => { o.hidden = false }); place() }
  document.getElementById('demo-start')?.addEventListener('click', () => setTimeout(reveal, 50))
  window.addEventListener('resize', () => { if (!openers[0].hidden) place() })

  const fitPhone = () => {
    views.mobile.style.setProperty('--fit', Math.min(1, (window.innerHeight - 64 - 44) / 844).toFixed(3))
  }
  const ready = (kind) => {
    const frame = views[kind].querySelector('iframe')
    views.mobile.style.background = isDark() ? '#0e1011' : '#ececee'
    if (!frame.getAttribute('src')) frame.src = `${address[kind]}&theme=${isDark() ? 'dark' : 'light'}`
    else frame.contentWindow?.postMessage({ type: 'pallet-theme', dark: isDark() }, window.location.origin)
  }
  const select = (kind) => {
    current = kind
    for (const [name, view] of Object.entries(views)) view.hidden = name !== kind
    tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.kind === kind)))
    ready(kind)
  }
  // The transform that puts a view over the spot on the page it came from
  const fromSource = (kind) => {
    const view = views[kind]
    const to = view.getBoundingClientRect()
    const from = sources[kind]().getBoundingClientRect()
    const fit = kind === 'mobile' ? Number(view.style.getPropertyValue('--fit')) || 1 : 1
    // (the phone carries its own scale, applied before this transform)
    return `translate(${(from.left - to.left) / fit}px, ${(from.top - to.top) / fit}px) scale(${from.width / to.width}, ${from.height / to.height})`
  }
  const glide = (kind, opening) => {
    const view = views[kind]
    const shrunk = { transform: fromSource(kind), borderRadius: '6px' }
    const grown = { transform: 'none' }
    return reduceMotion
      ? Promise.resolve()
      : view.animate(opening ? [shrunk, grown] : [grown, shrunk], { duration: opening ? 520 : 400, easing: EASE, fill: 'both' }).finished
          .then((a) => { if (opening) a.cancel() })
  }

  const open = async (kind) => {
    if (busy || expand.open) return
    busy = true
    fitPhone()
    expand.showModal()
    select(kind)
    requestAnimationFrame(() => expand.classList.add('shown'))
    await glide(kind, true)
    busy = false
  }
  const close = async () => {
    if (busy || !expand.open) return
    busy = true
    expand.classList.remove('shown')
    await glide(current, false)
    expand.close()
    views[current].getAnimations().forEach(a => a.cancel())
    busy = false
  }
  const swap = (kind) => {
    if (kind === current || busy) return
    select(kind)
    if (!reduceMotion) views[kind].animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE })
  }

  openers.forEach(opener => opener.addEventListener('click', () => open(opener.dataset.kind)))
  tabs.forEach(tab => tab.addEventListener('click', () => swap(tab.dataset.kind)))
  document.getElementById('expand-close').addEventListener('click', close)
  // Escape, or a click anywhere outside the screen, goes back to the page
  expand.addEventListener('cancel', (event) => { event.preventDefault(); close() })
  expand.addEventListener('click', (event) => { if (event.target === expand || event.target === stageEl || event.target.classList.contains('expand-bar')) close() })
  window.addEventListener('resize', fitPhone)
}

/* Sample documents open in a popup over the page rather than a new tab.
   Without script, the links still open the PDFs directly. */
const viewer = document.getElementById('viewer')
if (viewer && typeof viewer.showModal === 'function') {
  const files = { customer: './sample-quote.pdf', breakdown: './sample-breakdown.pdf' }
  const pages = [...viewer.querySelectorAll('.viewer-page')]
  const download = document.getElementById('viewer-dl')
  const stage = document.getElementById('viewer-body')

  // One page in front, the other behind it; the download follows the one in front
  const show = (doc) => {
    pages.forEach(page => {
      const front = page.dataset.doc === doc
      page.classList.toggle('is-front', front)
      page.setAttribute('aria-pressed', String(front))
    })
    download.href = files[doc]
  }

  for (const link of document.querySelectorAll('a[data-doc]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      show(link.dataset.doc)
      viewer.showModal()
    })
  }
  pages.forEach(page => page.addEventListener('click', () => show(page.dataset.doc)))
  viewer.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const behind = pages.find(page => !page.classList.contains('is-front'))
    if (behind) { show(behind.dataset.doc); behind.focus() }
  })
  document.getElementById('viewer-close').addEventListener('click', () => viewer.close())
  // A click on the dimmed area outside the sheet closes it; Escape does too
  viewer.addEventListener('click', (event) => { if (event.target === viewer || event.target === stage) viewer.close() })
}
