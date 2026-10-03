import '@fontsource-variable/outfit'
import './landing.css'
import './legal.css'
import { operator, lastUpdated, accounts, billing } from './operator'

// Two versions of some passages: one for when accounts exist, one for when they don't
for (const node of document.querySelectorAll('[data-accounts]')) {
  if ((node.dataset.accounts === 'on') !== accounts.enabled) node.remove()
}
// Likewise for payment: one version while it's free, one once subscriptions are on sale
for (const node of document.querySelectorAll('[data-billing]')) {
  if ((node.dataset.billing === 'on') !== billing.enabled) node.remove()
}
for (const node of document.querySelectorAll('[data-region]')) node.textContent = accounts.dataRegion

// Fill in the operator's details wherever the page asks for them
for (const node of document.querySelectorAll('[data-op]')) {
  const key = node.dataset.op
  const value = key === 'updated' ? lastUpdated : (operator[key] || '').trim()
  if (!value) {
    // ABN is optional: drop the whole phrase rather than show a gap
    if (key === 'abn') { (node.closest('[data-op-wrap]') || node).remove(); continue }
    node.textContent = '[to be confirmed]'
    node.classList.add('todo')
    continue
  }
  if (key === 'email') {
    const link = document.createElement('a')
    link.href = `mailto:${value}`
    link.textContent = value
    node.replaceChildren(link)
  } else {
    node.textContent = value
  }
}

// While any required detail is still a placeholder, say so plainly at the top of the page
if (document.querySelector('.todo')) {
  const banner = document.createElement('p')
  banner.className = 'legal-draft'
  banner.setAttribute('role', 'note')
  banner.textContent = 'Draft. Some details on this page are placeholders and will be filled in before it takes effect.'
  document.querySelector('.legal-meta')?.after(banner)
}
