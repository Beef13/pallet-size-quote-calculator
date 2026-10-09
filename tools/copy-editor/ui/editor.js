// The copy editor page. It asks the dev server what wording the site contains, shows it in the
// order it appears, and sends back only what was changed. It holds no list of its own: whatever
// the pages and the app contain today is what is shown.

const $ = (id) => document.getElementById(id)
const NBSP = String.fromCharCode(160)
const DRAFTS_KEY = 'copyEditorDrafts'
const LIMITS = {
  'Browser tab title': [60, 'Search engines usually show about 60.'],
  'Search result description': [160, 'Search engines usually show about 160.'],
  'Share preview title': [60, 'Longer titles are cut short when the link is shared.'],
  'Share preview description': [200, 'Longer descriptions are cut short when the link is shared.']
}
const HIDDEN_ROLES = new Set(['Screen-reader label', 'Image description'])
const VARIANT_TEXT = {
  'accounts on': 'With accounts on',
  'accounts off': 'With accounts off',
  'billing on': 'With paid plans on',
  'billing off': 'While it is free'
}

const state = {
  areas: [],
  base: '/',
  version: '',
  uncommitted: null,
  current: null,
  query: '',
  onlyChanged: false,
  hideHidden: false,
  drafts: new Map(),   // sig -> edited display tree
  items: new Map(),    // sig -> item as scanned
  staleRender: false
}

const store = {
  read(key) { try { return localStorage.getItem(key) } catch { return null } },
  write(key, value) { try { localStorage.setItem(key, value) } catch { /* private mode: drafts just don't survive a reload */ } }
}

/* ------------------------------------------------------------------ display trees */

const strip = (nodes) => nodes.map(n => n.t === 'text' ? { t: 'text', v: n.v }
  : n.t === 'tok' ? { t: 'tok', k: n.k } : { t: 'el', k: n.k, children: strip(n.children || []) })

// The same clean-up the server applies, so typing a stray space doesn't count as a change
function tidy(nodes, kind) {
  const exact = !kind.endsWith('-run')
  const clean = (list) => {
    const out = []
    for (const n of list) {
      if (n.t === 'text') {
        const v = exact ? n.v : n.v.split(NBSP).join(' ')
        const last = out[out.length - 1]
        if (last?.t === 'text') last.v += v
        else out.push({ t: 'text', v })
      } else if (n.t === 'el') {
        const children = clean(n.children || [])
        if (children.length) out.push({ ...n, children })
      } else out.push(n)
    }
    for (const n of out) if (n.t === 'text') n.v = exact ? n.v.replace(/[\r\n]+/g, ' ') : n.v.replace(/\s+/g, ' ')
    return out
  }
  const out = clean(nodes)
  if (out[0]?.t === 'text') out[0].v = out[0].v.trimStart()
  const last = out[out.length - 1]
  if (last?.t === 'text') last.v = last.v.trimEnd()
  return out.filter(n => n.t !== 'text' || n.v)
}

const same = (a, b, kind) => JSON.stringify(strip(tidy(a, kind))) === JSON.stringify(strip(tidy(b, kind)))
const plainOf = (nodes) => nodes.map(n => n.t === 'text' ? n.v : n.t === 'el' ? plainOf(n.children || []) : '').join('')
const keysIn = (nodes, out = new Map()) => {
  for (const n of nodes) {
    if (n.t === 'tok') out.set(n.k, n.label)
    if (n.t === 'el') { out.set(n.k, plainOf(n.children)); keysIn(n.children, out) }
  }
  return out
}

function paint(nodes, parent) {
  for (const n of nodes) {
    if (n.t === 'text') parent.append(document.createTextNode(n.v))
    else if (n.t === 'tok') {
      const chip = document.createElement('span')
      chip.className = 'chip'
      chip.contentEditable = 'false'
      chip.dataset.k = n.k
      chip.title = n.title || ''
      chip.textContent = n.label
      parent.append(chip)
    } else {
      const span = document.createElement('span')
      span.className = 'il'
      span.dataset.k = n.k
      span.dataset.tag = n.tag
      paint(n.children || [], span)
      parent.append(span)
    }
  }
}

function read(el, original) {
  const meta = new Map()
  const collect = (nodes) => { for (const n of nodes) { if (n.t !== 'text') meta.set(String(n.k), n); if (n.t === 'el') collect(n.children || []) } }
  collect(original)
  const walk = (parent) => {
    const out = []
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out.push({ t: 'text', v: child.data })
      else if (child.nodeType !== Node.ELEMENT_NODE || child.tagName === 'BR') continue
      else if (child.classList.contains('chip')) {
        const from = meta.get(child.dataset.k)
        if (from) out.push({ t: 'tok', k: from.k, label: from.label, title: from.title })
      } else if (child.classList.contains('il')) {
        const from = meta.get(child.dataset.k)
        if (from) out.push({ t: 'el', k: from.k, tag: from.tag, children: walk(child) })
        else out.push(...walk(child))
      } else out.push(...walk(child))   // anything the browser added on its own is just its text
    }
    return out
  }
  return walk(el)
}

/* ------------------------------------------------------------------ loading */

async function load({ keepScroll = false } = {}) {
  const response = await fetch('./api/scan', { cache: 'no-store' })
  const data = await response.json()
  state.areas = data.areas
  state.base = data.base
  state.version = data.version
  state.uncommitted = data.uncommitted
  state.problems = data.problems || []

  // Each piece of text gets a key that survives the file being re-saved: where it is and what it says
  state.items = new Map()
  const seen = new Map()
  for (const area of state.areas) {
    area.count = 0
    for (const group of area.groups) {
      for (const item of group.items) {
        const key = `${item.file}|${item.kind}|${item.role}|${item.plain}`
        const nth = seen.get(key) || 0
        seen.set(key, nth + 1)
        item.sig = `${key}|${nth}`
        item.area = area
        item.group = group
        const plainKey = `${item.file}|${item.plain}`
        item.nth = seen.get(plainKey) || 0
        seen.set(plainKey, item.nth + 1)
        state.items.set(item.sig, item)
        area.count++
      }
    }
  }

  // Unsaved edits are kept by the browser, so a reload or a change to the files doesn't lose them
  let dropped = 0
  const saved = new Map(state.drafts)
  if (!saved.size) {
    try { for (const [sig, nodes] of JSON.parse(store.read(DRAFTS_KEY) || '[]')) saved.set(sig, nodes) } catch { /* ignore */ }
  }
  state.drafts = new Map()
  for (const [sig, nodes] of saved) {
    const item = state.items.get(sig)
    if (item && !same(nodes, item.nodes, item.kind)) state.drafts.set(sig, nodes)
    else if (!item) dropped++
  }
  persist()
  if (dropped) toast(`${dropped} unsaved ${dropped === 1 ? 'edit no longer matches' : 'edits no longer match'} the files and ${dropped === 1 ? 'was' : 'were'} dropped.`, true)

  if (!state.current || !state.areas.some(a => a.id === state.current)) state.current = state.areas[0]?.id || null
  render({ keepScroll })
}

function persist() {
  store.write(DRAFTS_KEY, JSON.stringify([...state.drafts]))
}

/* ------------------------------------------------------------------ drawing the page */

const draftCount = (area) => [...state.drafts.keys()].filter(sig => state.items.get(sig)?.area === area).length

function renderRail() {
  const list = $('areas')
  list.replaceChildren()
  for (const area of state.areas) {
    const li = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    if (area.id === state.current && !state.query) button.setAttribute('aria-current', 'true')
    const name = document.createElement('span')
    name.textContent = area.name
    button.append(name)
    if (draftCount(area)) { const dot = document.createElement('span'); dot.className = 'dot'; dot.title = 'Has unsaved changes'; button.append(dot) }
    const count = document.createElement('span')
    count.className = 'count'
    count.textContent = area.count
    button.append(count)
    button.addEventListener('click', () => {
      state.current = area.id
      state.query = ''
      $('search').value = ''
      render()
      $('list').scrollTop = 0
    })
    li.append(button)
    list.append(li)
  }

  const note = $('live-note')
  const scanned = new Set(state.areas.flatMap(a => a.files))
  const waiting = (state.uncommitted || []).filter(file => scanned.has(file))
  note.classList.toggle('waiting', waiting.length > 0)
  note.replaceChildren()
  const strong = document.createElement('strong')
  const text = document.createElement('span')
  if (waiting.length) {
    strong.textContent = 'Saved here, not live yet'
    text.textContent = `${waiting.length} ${waiting.length === 1 ? 'file has' : 'files have'} wording changes waiting for the next deploy.`
  } else {
    strong.textContent = 'Nothing goes live from here'
    text.textContent = 'Saving writes your wording into the site\'s files on this computer. The live site changes at the next deploy.'
  }
  note.append(strong, text)
}

function renderPending() {
  const n = state.drafts.size
  $('pending').classList.remove('saved')
  $('pending').textContent = n ? `${n} unsaved ${n === 1 ? 'change' : 'changes'}` : ''
  $('save').disabled = n === 0
  $('discard').hidden = n === 0
}

function matches(item) {
  if (state.hideHidden && HIDDEN_ROLES.has(item.role)) return false
  if (state.onlyChanged && !state.drafts.has(item.sig)) return false
  if (!state.query) return true
  const q = state.query.toLowerCase()
  const now = state.drafts.get(item.sig)
  return item.plain.toLowerCase().includes(q) || item.role.toLowerCase().includes(q) || (now && plainOf(now).toLowerCase().includes(q))
}

function render({ keepScroll = false } = {}) {
  const scroller = $('list')
  const top = scroller.scrollTop
  renderRail()
  renderPending()

  const searching = Boolean(state.query)
  const areas = searching ? state.areas : state.areas.filter(a => a.id === state.current)
  const area = areas[0]
  const holder = $('groups')
  holder.replaceChildren()

  for (const problem of state.problems || []) {
    const p = document.createElement('p')
    p.className = 'problem'
    p.textContent = `${problem.file} could not be read, so its wording is not listed: ${problem.error}`
    holder.append(p)
  }

  let shown = 0
  for (const a of areas) {
    for (const group of a.groups) {
      const items = group.items.filter(matches)
      if (!items.length) continue
      shown += items.length
      const section = document.createElement('section')
      section.className = 'group'
      const head = document.createElement('div')
      head.className = 'group-head'
      const h2 = document.createElement('h2')
      h2.textContent = searching ? `${a.name}: ${group.name}` : group.name
      const where = document.createElement('span')
      where.className = 'where'
      where.textContent = group.file
      head.append(h2, where)
      const rows = document.createElement('div')
      rows.className = 'rows'
      for (const item of items) rows.append(row(item))
      section.append(head, rows)
      holder.append(section)
    }
  }

  if (!shown) {
    const p = document.createElement('p')
    p.className = 'empty'
    p.textContent = searching ? 'Nothing on the site matches that search.' : state.onlyChanged ? 'No unsaved changes here.' : 'No wording found here.'
    holder.append(p)
  }

  if (searching) {
    $('area-name').textContent = 'Search results'
    $('area-sub').textContent = `${shown} ${shown === 1 ? 'piece' : 'pieces'} of text across the whole site`
  } else if (area) {
    $('area-name').textContent = area.name
    $('area-sub').textContent = `${area.count} pieces of text, in the order they appear`
  } else {
    $('area-name').textContent = 'No wording found'
    $('area-sub').textContent = ''
  }

  if (keepScroll) scroller.scrollTop = top
  if (!searching) showPreview(area)
  state.staleRender = false
}

function row(item) {
  const el = document.createElement('div')
  el.className = 'row'
  el.dataset.sig = item.sig

  const what = document.createElement('div')
  what.className = 'what'
  const role = document.createElement('div')
  role.textContent = item.role
  what.append(role)
  for (const variant of item.variants || []) {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = VARIANT_TEXT[variant] || variant
    tag.title = 'This version is only shown in that situation'
    what.append(tag, ' ')
  }

  const wrap = document.createElement('div')
  wrap.className = 'field-wrap'
  const field = document.createElement('div')
  field.className = `field${/heading/i.test(item.role) ? ' heading' : ''}`
  field.contentEditable = 'true'
  field.spellcheck = true
  field.setAttribute('role', 'textbox')
  field.setAttribute('aria-label', `${item.role}: ${item.plain}`)
  paint(state.drafts.get(item.sig) || item.nodes, field)
  const under = document.createElement('div')
  under.className = 'under'
  wrap.append(field, under)
  el.append(what, wrap)

  const refresh = () => {
    const now = read(field, item.nodes)
    const changed = !same(now, item.nodes, item.kind)
    if (changed) state.drafts.set(item.sig, tidy(now, item.kind))
    else state.drafts.delete(item.sig)
    persist()
    decorate(el, item, under, now, changed)
    renderPending()
    renderDots()
    return now
  }

  field.addEventListener('beforeinput', (event) => {
    if (event.inputType.startsWith('format') || event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') event.preventDefault()
  })
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); field.blur() }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save() }
  })
  field.addEventListener('paste', (event) => {
    event.preventDefault()
    const text = (event.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' ')
    document.execCommand('insertText', false, text)
  })
  field.addEventListener('drop', (event) => event.preventDefault())
  field.addEventListener('input', () => {
    const now = refresh()
    typeIntoPreview(item, now)
  })
  field.addEventListener('focus', () => {
    document.querySelectorAll('.row.located').forEach(r => r.classList.remove('located'))
    el.classList.add('located')
    locate(item)
  })
  field.addEventListener('blur', () => {
    // Show the text as it will be saved (doubled spaces gone, edges trimmed)
    const draft = state.drafts.get(item.sig)
    if (draft) { field.replaceChildren(); paint(draft, field) }
    if (state.staleRender) render({ keepScroll: true })
  })

  under.addEventListener('click', (event) => {
    if (event.target.dataset.act !== 'undo') return
    field.replaceChildren()
    paint(item.nodes, field)
    const now = refresh()
    typeIntoPreview(item, now)
  })

  decorate(el, item, under, state.drafts.get(item.sig) || item.nodes, state.drafts.has(item.sig))
  return el
}

function decorate(el, item, under, now, changed) {
  el.classList.toggle('changed', changed)
  under.replaceChildren()
  const add = (text, cls) => { const span = document.createElement('span'); span.textContent = text; if (cls) span.className = cls; under.append(span); return span }

  const before = keysIn(item.nodes)
  const after = keysIn(now)
  const lost = [...before].filter(([k]) => !after.has(k)).map(([, label]) => label)
  if (lost.length) add(`Removed: ${lost.map(l => `“${l}”`).join(', ')}. A link or a value the page fills in goes with it.`, 'warn')
  if (!plainOf(tidy(now, item.kind)).trim() && !after.size) add('Empty. Nothing will be shown here.', 'warn')

  const limit = LIMITS[item.role]
  if (limit) {
    const length = plainOf(now).trim().length
    add(`${length} characters. ${limit[1]}`, length > limit[0] ? 'over' : '')
  }
  if (changed) {
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    under.append(spacer)
    const undo = document.createElement('button')
    undo.type = 'button'
    undo.dataset.act = 'undo'
    undo.textContent = 'Undo'
    undo.title = `Back to: ${item.plain}`
    under.append(undo)
  }
}

function renderDots() {
  // Only the unsaved-change markers in the list of pages; the rows themselves are left alone
  const buttons = $('areas').querySelectorAll('button')
  state.areas.forEach((area, i) => {
    const button = buttons[i]
    if (!button) return
    const has = draftCount(area) > 0
    const dot = button.querySelector('.dot')
    if (has && !dot) { const d = document.createElement('span'); d.className = 'dot'; d.title = 'Has unsaved changes'; button.insertBefore(d, button.querySelector('.count')) }
    if (!has && dot) dot.remove()
  })
}

/* ------------------------------------------------------------------ the page beside the editor */

let previewFor = null
const norm = (text) => (text || '').split(NBSP).join(' ').replace(/\s+/g, ' ').trim()
let marked = null
let target = null

function showPreview(area) {
  if (!area) return
  const frame = $('frame')
  const none = $('preview-none')
  $('preview-name').textContent = area.name
  if (!area.preview) {
    frame.hidden = true
    none.hidden = false
    none.textContent = area.id === 'pdf'
      ? 'The PDFs are made inside the calculator. Export a quote there to see this wording in place.'
      : 'This wording is used on more than one page, so there is no single page to show.'
    $('preview-open').hidden = true
    $('preview-hint').textContent = ''
    previewFor = null
    return
  }
  frame.hidden = false
  none.hidden = true
  const url = state.base + area.preview
  $('preview-open').hidden = false
  $('preview-open').href = url
  if (previewFor !== url) {
    previewFor = url
    frame.src = url
    $('preview-hint').textContent = 'Click into any text to find it on the page.'
  }
}

function find(item, text) {
  const doc = $('frame').contentDocument
  if (!doc?.body || $('frame').hidden) return null
  const want = norm(text)
  if (!want) return null
  const visible = (el) => el.getClientRects().length > 0
  const pick = (list) => {
    const seen = list.filter(m => visible(m.el))
    const pool = seen.length ? seen : list
    return pool[item.nth] || pool[0] || null
  }

  if (/attr$/.test(item.kind) || /label|tip|description|placeholder/i.test(item.role)) {
    const hits = [...doc.querySelectorAll('[aria-label],[title],[alt],[placeholder]')]
      .filter(el => ['aria-label', 'title', 'alt', 'placeholder'].some(name => norm(el.getAttribute(name)) === want))
      .map(el => ({ el }))
    if (hits.length) return pick(hits)
  }

  const texts = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (norm(node.data) === want && node.parentElement && !['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) texts.push({ el: node.parentElement, node })
  }
  if (texts.length) return pick(texts)

  // A sentence with bold text, links or filled-in values: match on its longest stretch of plain words
  const parts = item.nodes.filter(n => n.t === 'text').map(n => norm(n.v)).sort((a, b) => b.length - a.length)
  const probe = item.nodes.some(n => n.t !== 'text') ? parts[0] : want
  if (!probe || probe.length < 4) return null
  const hits = []
  const elements = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  while (elements.nextNode()) {
    const el = elements.currentNode
    if (['SCRIPT', 'STYLE', 'SVG'].includes(el.tagName.toUpperCase())) continue
    if (!norm(el.textContent).includes(probe)) continue
    if ([...el.children].some(child => norm(child.textContent).includes(probe))) continue
    hits.push({ el })
  }
  return pick(hits)
}

let locating = 0
async function locate(item) {
  const turn = ++locating
  if (marked) { for (const p of ['outline', 'outline-offset', 'box-shadow']) marked.style.removeProperty(p); marked = null }
  target = null
  if ($('shell').classList.contains('no-preview')) return
  // From search results the text may be on a different page from the one showing
  const frame = $('frame')
  const url = item.area.preview ? state.base + item.area.preview : null
  if (previewFor !== url) {
    showPreview(item.area)
    if (!url) return
    await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }))
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  if (!url || turn !== locating) return
  let hit = find(item, item.plain)
  if (!hit || !hit.el.getClientRects().length) {
    // In the calculator, text on another tab only exists once that tab is open
    const tabName = /^(.*) tab$/.exec(item.group.name)?.[1]
    const tab = tabName && [...(frame.contentDocument?.querySelectorAll('[role="tab"]') || [])].find(t => norm(t.textContent) === tabName)
    if (tab && tab.getAttribute('aria-selected') !== 'true') {
      tab.click()
      await new Promise(resolve => setTimeout(resolve, 350))
      if (turn !== locating) return
      hit = find(item, item.plain) || hit
    }
  }
  if (!hit) {
    $('preview-hint').textContent = 'Not on the page as it is showing now. It may be in a pop-up, or only shown in some situations.'
    return
  }
  target = { item, ...hit }
  marked = hit.el
  // White inside blue, so the ring shows on the blue panels as well as the white ones
  hit.el.style.setProperty('outline', '3px solid #ffffff', 'important')
  hit.el.style.setProperty('outline-offset', '3px', 'important')
  hit.el.style.setProperty('box-shadow', '0 0 0 9px #2563d9', 'important')
  hit.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  $('preview-hint').textContent = hit.el.getClientRects().length ? 'Ringed in blue on the page.' : 'Found, but hidden on the page as it is showing now.'
}

// Plain text can be shown changing as it is typed; anything else updates when it is saved
function typeIntoPreview(item, now) {
  if (!target || target.item !== item || !target.node || !target.node.isConnected) return
  if (now.some(n => n.t !== 'text')) return
  const data = target.node.data
  target.node.data = data.match(/^\s*/)[0] + plainOf(tidy(now, item.kind)) + data.match(/\s*$/)[0]
}

/* ------------------------------------------------------------------ saving */

let toastTimer = 0
function toast(message, bad = false) {
  const el = $('toast')
  el.textContent = message
  el.classList.toggle('bad', bad)
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.hidden = true }, bad ? 9000 : 5000)
}

let saving = false
async function save(retry = true) {
  if (saving || !state.drafts.size) return
  saving = true
  $('save').disabled = true
  $('save').textContent = 'Saving…'
  try {
    const edits = [...state.drafts].map(([sig, nodes]) => ({ id: state.items.get(sig).id, nodes: strip(nodes) }))
    const response = await fetch('./api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edits }) })
    const result = await response.json()
    if (!result.ok) {
      if (result.stale && retry) {
        // The files changed underneath (someone edited the layout). Pick up the new version and try once more.
        saving = false
        await load({ keepScroll: true })
        return save(false)
      }
      throw new Error(result.error || 'The changes could not be saved.')
    }
    const count = edits.length
    state.drafts = new Map()
    persist()
    await load({ keepScroll: true })
    const files = result.files.length
    toast(`Saved ${count} ${count === 1 ? 'change' : 'changes'} to ${files} ${files === 1 ? 'file' : 'files'} on this computer. The live site changes at the next deploy.`)
    $('pending').textContent = 'All changes saved'
    $('pending').classList.add('saved')
  } catch (error) {
    toast(error.message, true)
  } finally {
    saving = false
    $('save').textContent = 'Save changes'
    $('save').disabled = state.drafts.size === 0
  }
}

/* ------------------------------------------------------------------ controls */

$('save').addEventListener('click', () => save())
$('discard').addEventListener('click', () => {
  const n = state.drafts.size
  if (!n) return
  const kept = new Map(state.drafts)
  state.drafts = new Map()
  persist()
  render({ keepScroll: true })
  toast(`Discarded ${n} unsaved ${n === 1 ? 'change' : 'changes'}.`)
  // One click to take it back, in case that was a slip
  const undo = document.createElement('button')
  undo.type = 'button'
  undo.textContent = 'Undo'
  undo.style.cssText = 'margin-left:12px;border:0;background:none;color:inherit;text-decoration:underline;padding:0'
  undo.addEventListener('click', () => { state.drafts = kept; persist(); render({ keepScroll: true }); $('toast').hidden = true })
  $('toast').append(undo)
})

let searchTimer = 0
$('search').addEventListener('input', (event) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { state.query = event.target.value.trim(); render(); $('list').scrollTop = 0 }, 140)
})
$('only-changed').addEventListener('change', (event) => { state.onlyChanged = event.target.checked; render() })
$('hide-hidden').addEventListener('change', (event) => { state.hideHidden = event.target.checked; render() })

$('preview-toggle').addEventListener('click', (event) => {
  const off = $('shell').classList.toggle('no-preview')
  event.currentTarget.setAttribute('aria-pressed', String(!off))
  store.write('copyEditorPreview', off ? 'off' : 'on')
})
if (store.read('copyEditorPreview') === 'off' || (store.read('copyEditorPreview') === null && window.innerWidth < 1180)) {
  $('shell').classList.add('no-preview')
  $('preview-toggle').setAttribute('aria-pressed', 'false')
}
// "Computer" shows the page at a desktop width, shrunk to fit the space beside the editor
const DESKTOP = 1280
function fitPreview() {
  const stage = $('stage')
  const frame = $('frame')
  if (stage.classList.contains('phone') || !stage.clientWidth) {
    frame.style.cssText = ''
    return
  }
  const scale = Math.min(1, stage.clientWidth / DESKTOP)
  frame.style.width = `${DESKTOP}px`
  frame.style.height = `${stage.clientHeight / scale}px`
  frame.style.transform = `scale(${scale})`
}
new ResizeObserver(fitPreview).observe($('stage'))
for (const button of document.querySelectorAll('.seg')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b => b.classList.toggle('on', b === button))
    $('stage').classList.toggle('phone', button.dataset.width === 'phone')
    fitPreview()
  })
}
$('theme').addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark')
  store.write('copyEditorDark', String(dark))
})

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save() }
})
window.addEventListener('beforeunload', (event) => {
  // Drafts are kept by the browser, so nothing is lost; no need to nag on the way out
  if (saving) event.preventDefault()
})

// The pages and the app can change while this is open (a new section, a renamed tab).
// Check every few seconds and pick the changes up, without interrupting typing.
setInterval(async () => {
  if (saving || document.hidden) return
  try {
    const { version } = await (await fetch('./api/version', { cache: 'no-store' })).json()
    if (version === state.version) return
    const typing = document.activeElement?.classList.contains('field')
    if (typing) {
      // Refresh what is known about the files now; redraw once the cursor leaves the field
      state.version = version
      state.staleRender = true
      return
    }
    await load({ keepScroll: true })
  } catch { /* the dev server was stopped; nothing to do until it is back */ }
}, 4000)

load().catch(error => {
  $('area-name').textContent = 'The editor could not load'
  $('area-sub').textContent = error.message
})
