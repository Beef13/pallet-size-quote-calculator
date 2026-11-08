// The time-first landing page. It shares the first page's styles and behaviour
// (theme, accounts and billing passages, the demo recording, reveals, the sample
// document viewer) and adds its own sections: the nine jobs and the time calculator.
import './landing.js'
import './time.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* The nine jobs. When the list comes into view the rows arrive one after another and
   the six Pallet Quoter does are ticked off, so the three left with "You" stand out.
   With reduced motion, or no IntersectionObserver, the list is shown already done. */
const jobs = document.querySelector('[data-jobs]')
if (jobs) {
  if (reduceMotion || !('IntersectionObserver' in window)) {
    jobs.classList.add('run', 'settled')
  } else {
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      seen.disconnect()
      jobs.classList.add('run')
    }, { threshold: 0.25 })
    seen.observe(jobs)
  }
}

/* What quoting costs now, from the visitor's own figures. Only the time they spend
   today is added up; the page makes no claim about how much of it they'll save. */
const form = document.querySelector('[data-cost]')
if (form) {
  const WEEKS = 48
  const HOURS_A_DAY = 8
  const field = (name) => form.querySelector(`[data-cost-in="${name}"]`)
  const out = (name) => form.querySelector(`[data-cost-out="${name}"]`)
  const read = (name) => {
    const value = Number(field(name).value)
    return Number.isFinite(value) && value > 0 ? value : 0
  }
  const whole = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 })
  const oneDp = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 })
  const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

  const update = () => {
    const hours = (read('quotes') * read('minutes') * WEEKS) / 60
    out('hours').textContent = hours >= 10 ? whole.format(hours) : oneDp.format(hours)
    out('days').textContent = oneDp.format(hours / HOURS_A_DAY)
    out('money').textContent = money.format(hours * read('rate'))
  }
  form.addEventListener('input', update)
  form.addEventListener('submit', (event) => event.preventDefault())
  update()
}
