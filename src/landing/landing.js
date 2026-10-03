import '@fontsource-variable/outfit'
import './landing.css'
import demoLight from './img/app-demo-light.mp4'
import demoDark from './img/app-demo-dark.mp4'
import demoLightWebm from './img/app-demo-light.webm'
import demoDarkWebm from './img/app-demo-dark.webm'
import posterLight from './img/app-demo-poster-light.webp'
import posterDark from './img/app-demo-poster-dark.webp'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Passages that differ depending on whether this build has accounts switched on
const accountsOn = Boolean(import.meta.env.VITE_SUPABASE_URL)
for (const node of document.querySelectorAll('[data-accounts]')) {
  if ((node.dataset.accounts === 'on') !== accountsOn) node.remove()
}

/* Demo video: a recording of the calculator in use, in the light or dark
   version to match the page. It plays muted on a loop while it is on
   screen. With reduced motion it stays on its poster and gets controls. */
const video = document.getElementById('hero-video')
if (video) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  let onScreen = true
  const play = () => { if (!reduceMotion && onScreen) video.play().catch(() => {}) }
  const load = () => {
    video.poster = dark.matches ? posterDark : posterLight
    // MP4 wherever the browser can play it, WebM otherwise
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
    }).observe(video)
  }
}
