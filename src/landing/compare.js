import './compare.css'

/* Two landing page layouts are being compared: the full one at the site root and the
   shorter one at /v2/. This puts a small switch at the foot of both so either can be
   opened from the other; pressing V does the same. It only appears with ?compare in the address. Remove this file, its import in
   landing.js and the /v2/ page (or the root one) once a layout has been chosen. */
export function mountCompare() {
  // Only for whoever is comparing the layouts: the switch shows when the address ends in
  // ?compare (for example palletquoter.com/?compare) and stays on while moving between the two.
  // Visitors never see it, and V does nothing for them.
  if (!new URLSearchParams(window.location.search).has('compare')) return
  const onNew = document.body.classList.contains('v2')
  const versions = [
    { name: 'Current', href: onNew ? '../index.html?compare' : './index.html?compare', here: !onNew },
    { name: 'New', href: onNew ? './index.html?compare' : './v2/index.html?compare', here: onNew }
  ]
  const bar = document.createElement('nav')
  bar.className = 'compare'
  bar.setAttribute('aria-label', 'Landing page version')
  const label = document.createElement('span')
  label.textContent = 'Layout'
  bar.append(label)
  for (const version of versions) {
    const link = document.createElement('a')
    link.href = version.href
    link.textContent = version.name
    if (version.here) link.setAttribute('aria-current', 'page')
    bar.append(link)
  }
  document.body.append(bar)

  const other = versions.find(version => !version.here)
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'v' || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return
    window.location.href = other.href
  })
}
