import '@fontsource-variable/outfit'
import './landing.css'
import './legal.css'
import { operator, lastUpdated } from './operator'

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
