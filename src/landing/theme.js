// Light and dark: follows the device until someone chooses, then remembers the choice.
// The choice is stored under the same key the calculator uses, so the two always agree.
const KEY = 'palletDarkMode'
const root = document.documentElement
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = []

const saved = () => {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'true' ? true : value === 'false' ? false : null
  } catch (e) { return null }
}

export const isDark = () => saved() ?? media.matches

/** Run `fn` whenever the theme changes, by the toggle or by the device setting. */
export const onThemeChange = (fn) => { listeners.push(fn) }

function apply() {
  const choice = saved()
  if (choice === null) delete root.dataset.theme
  else root.dataset.theme = choice ? 'dark' : 'light'
  const dark = isDark()
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    const label = dark ? 'Use light theme' : 'Use dark theme'
    button.toggleAttribute('data-dark', dark)
    button.setAttribute('aria-label', label)
    button.title = label
  }
  listeners.forEach(fn => fn(dark))
}

for (const button of document.querySelectorAll('[data-theme-toggle]')) {
  button.addEventListener('click', () => {
    try { localStorage.setItem(KEY, String(!isDark())) } catch (e) { /* private browsing: nothing to remember */ }
    apply()
  })
}
media.addEventListener?.('change', apply)
apply()
