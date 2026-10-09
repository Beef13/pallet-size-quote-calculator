// Finds every piece of wording in the site's own source files, and writes edits back to them.
//
// Nothing here is a list of "editable fields". The pages (HTML) and the app (JS/JSX) are parsed
// and walked, and whatever text they contain is reported in the order it appears. Add a section
// to the landing page, a tab to the app or a line to the PDFs, and it shows up the next time the
// editor looks; remove one and it goes.
//
// An edit replaces only the characters of that one piece of text. Tags, links, live values
// (`{quantity}`, `${name}`) and everything else around it are copied back from the file untouched.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parse as parseHtml, parseFragment } from 'parse5'
import { parse as parseJs } from '@babel/parser'

/* ------------------------------------------------------------------ shared helpers */

const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 10)
const collapse = (text) => text.replace(/\s+/g, ' ')
const hasWord = (text) => /[\p{L}\p{N}]/u.test(text)
const humanise = (name) => String(name)
  .replace(/[-_]+/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
const sentence = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1) : text
const clip = (text, n = 60) => text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text

// Tags that sit inside a sentence rather than starting a new block
const INLINE = new Set(['a', 'strong', 'em', 'b', 'i', 'span', 'br', 'code', 'small', 'sup', 'sub', 'u', 'mark', 'abbr', 'kbd', 's', 'cite', 'q', 'time', 'wbr'])
const VOID = new Set(['br', 'wbr', 'img', 'input', 'hr', 'meta', 'link'])

/** Plain text of a display tree, as the reader would see it. */
export function plainOf(nodes) {
  return nodes.map(n => n.t === 'text' ? n.v : n.t === 'el' ? plainOf(n.children) : '').join('')
}

/** The part of a segment the editor page needs (no file offsets). */
function publicView(seg) {
  const { keys, start, end, lead, trail, quote, ...rest } = seg
  return rest
}

/* ------------------------------------------------------------------ HTML pages */

const HTML_SKIP = new Set(['script', 'style', 'svg', 'iframe', 'video', 'canvas', 'object'])
const HTML_COPY_ATTRS = new Set(['aria-label', 'title', 'alt', 'placeholder'])
const HTML_ATTR_ROLE = {
  'aria-label': 'Screen-reader label',
  title: 'Hover tip',
  alt: 'Image description',
  placeholder: 'Placeholder'
}
const META_ROLE = {
  description: 'Search result description',
  'og:title': 'Share preview title',
  'og:description': 'Share preview description',
  'twitter:title': 'Share preview title',
  'twitter:description': 'Share preview description',
  'application-name': 'App name',
  'apple-mobile-web-app-title': 'Home screen name'
}
const TAG_ROLE = {
  h1: 'Main heading', h2: 'Heading', h3: 'Subheading', h4: 'Subheading', h5: 'Subheading', h6: 'Subheading',
  p: 'Paragraph', li: 'List item', button: 'Button', summary: 'Question', label: 'Label',
  th: 'Table heading', td: 'Table cell', figcaption: 'Caption', dt: 'Term', dd: 'Description',
  title: 'Browser tab title', option: 'Menu option', legend: 'Label', caption: 'Caption', blockquote: 'Quote'
}

const attrOf = (el, name) => el.attrs?.find(a => a.name === name)?.value
const variantsOf = (el) => (el.attrs || [])
  .filter(a => (a.name === 'data-accounts' || a.name === 'data-billing') && a.value)
  .map(a => `${a.name.slice(5)} ${a.value}`)
const textOfHtml = (node) => node.nodeName === '#text' ? node.value
  : (node.childNodes || node.content?.childNodes || []).map(textOfHtml).join('')
// As read out: decorative parts left out, and a space wherever one tag ends and the next begins
const spokenText = (node) => node.nodeName === '#text' ? node.value
  : attrOf(node, 'aria-hidden') === 'true' ? ''
  : (node.childNodes || []).map(spokenText).join(' ')

function htmlRole(el) {
  // A span inside a button is still button text: look a few levels up for something meaningful
  for (let node = el, depth = 0; node && depth < 4; node = node.parentNode, depth++) {
    const tag = node.tagName
    if (!tag) break
    if (tag === 'a') return /\bbtn\b/.test(attrOf(node, 'class') || '') ? 'Button' : 'Link'
    if (TAG_ROLE[tag]) return TAG_ROLE[tag]
  }
  return 'Text'
}

export function scanHtml(file, source) {
  const doc = parseHtml(source, { sourceCodeLocationInfo: true, scriptingEnabled: false })
  const segments = []
  let lastHeading = ''

  const add = (seg) => {
    seg.file = file
    seg.plain = plainOf(seg.nodes)
    if (!hasWord(seg.plain)) return
    seg.id = `${file}:${seg.start}:${hash(source.slice(seg.start, seg.end))}`
    segments.push(seg)
  }

  const sectionLabel = (el) => {
    const label = attrOf(el, 'aria-label')
    if (label) return label
    const find = (node) => {
      for (const child of node.childNodes || []) {
        if (/^h[1-3]$/.test(child.tagName || '')) return child
        const found = find(child)
        if (found) return found
      }
      return null
    }
    const heading = find(el)
    if (heading) return clip(collapse(spokenText(heading)).trim())
    if (el.tagName === 'header') return 'Top bar and menu'
    if (el.tagName === 'footer') return 'Footer'
    const id = attrOf(el, 'id')
    if (id) return sentence(humanise(id))
    return sentence(el.tagName)
  }

  const scanAttrs = (el, ctx) => {
    const loc = el.sourceCodeLocation
    if (!loc?.attrs) return
    const candidates = []
    if (el.tagName === 'meta') {
      const key = attrOf(el, 'name') || attrOf(el, 'property')
      if (META_ROLE[key]) candidates.push(['content', META_ROLE[key]])
    }
    for (const attr of el.attrs) {
      if (HTML_COPY_ATTRS.has(attr.name)) candidates.push([attr.name, HTML_ATTR_ROLE[attr.name]])
      // Wording kept in a data attribute for a script to show, e.g. rotating phrases
      else if (attr.name.startsWith('data-') && /[A-Za-z]{2,} [A-Za-z]{2,}/.test(attr.value)) {
        candidates.push([attr.name, sentence(humanise(attr.name.slice(5)))])
      }
    }
    for (const [name, role] of candidates) {
      const at = loc.attrs[name]
      const value = attrOf(el, name)
      if (!at || !value || !value.trim()) continue
      const raw = source.slice(at.startOffset, at.endOffset)
      const open = raw.match(/^[^=]+=\s*(["'])/)
      if (!open || raw[raw.length - 1] !== open[1]) continue
      add({
        kind: 'html-attr', role, group: ctx.group(), variants: ctx.variants, quote: open[1],
        start: at.startOffset + open[0].length, end: at.endOffset - 1,
        nodes: [{ t: 'text', v: value }], keys: []
      })
    }
  }

  // Can this element stay inside a sentence, as bold text or a link does?
  const isInline = (el) => {
    if (!el.tagName || !INLINE.has(el.tagName) || variantsOf(el).length) return false
    const loc = el.sourceCodeLocation
    if (!loc) return false
    if (VOID.has(el.tagName)) return true
    if (!loc.startTag || !loc.endTag) return false
    return el.childNodes.every(c => c.nodeName === '#text' || isInline(c))
  }

  const emitRun = (items, parent, ctx) => {
    const keys = []
    const build = (node) => {
      if (node.nodeName === '#text') return { t: 'text', v: collapse(node.value) }
      const loc = node.sourceCodeLocation
      scanAttrs(node, ctx)
      const empty = VOID.has(node.tagName) || !hasWord(textOfHtml(node))
      if (empty) {
        keys.push({ range: [loc.startOffset, loc.endOffset] })
        const what = node.tagName === 'br' ? 'line break'
          : attrOf(node, 'data-op') || (node.attrs.find(a => a.name.startsWith('data-'))?.name.slice(5)) || node.tagName
        return { t: 'tok', k: keys.length - 1, label: humanise(what), title: 'Filled in or placed by the page. It stays as it is.' }
      }
      keys.push({ open: [loc.startTag.startOffset, loc.startTag.endOffset], close: [loc.endTag.startOffset, loc.endTag.endOffset] })
      const k = keys.length - 1
      return { t: 'el', k, tag: node.tagName, children: node.childNodes.map(build) }
    }
    const nodes = items.map(build)
    let start = items[0].sourceCodeLocation.startOffset
    let end = items[items.length - 1].sourceCodeLocation.endOffset
    // Spacing and line breaks at either edge belong to the page's layout, not to the wording
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (first.t === 'text') {
      start += source.slice(start, end).match(/^\s*/)[0].length
      first.v = first.v.trimStart()
    }
    if (last.t === 'text') {
      end -= source.slice(start, end).match(/\s*$/)[0].length
      last.v = last.v.trimEnd()
    }
    if (end <= start) return
    add({
      kind: 'html-run', role: htmlRole(parent), group: ctx.group(), variants: ctx.variants,
      start, end, nodes: nodes.filter(n => n.t !== 'text' || n.v), keys
    })
  }

  const walk = (el, ctx) => {
    const tag = el.tagName
    if (tag && HTML_SKIP.has(tag)) return
    if (tag) {
      const variants = variantsOf(el)
      if (variants.length) ctx = { ...ctx, variants: [...ctx.variants, ...variants] }
      if (tag === 'head') ctx = { ...ctx, group: () => 'Search and sharing' }
      else if (['section', 'article', 'dialog', 'footer', 'header'].includes(tag) || (['nav', 'aside', 'form'].includes(tag) && !ctx.inSection)) {
        const label = sectionLabel(el)
        ctx = { ...ctx, inSection: true, group: () => label }
      }
      if (/^h[12]$/.test(tag) && !ctx.inSection) lastHeading = clip(collapse(spokenText(el)).trim())
      scanAttrs(el, ctx)
    }
    const children = (tag === 'template' ? el.content?.childNodes : el.childNodes) || []
    const directText = children.some(c => c.nodeName === '#text' && c.value.trim())
    if (!directText) {
      for (const child of children) if (child.tagName) walk(child, ctx)
      return
    }
    let run = []
    const flush = () => {
      if (run.some(n => hasWord(textOfHtml(n)))) emitRun(run, el, ctx)
      else for (const n of run) if (n.tagName) walk(n, ctx)
      run = []
    }
    for (const child of children) {
      if (child.nodeName === '#text' || isInline(child)) run.push(child)
      else {
        flush()
        if (child.tagName) walk(child, ctx)
      }
    }
    flush()
  }

  walk(doc, { variants: [], inSection: false, group: () => lastHeading || 'Top of page' })
  return segments
}

/* ------------------------------------------------------------------ JS and JSX */

// Attributes and property names whose values are code, not wording
const CODE_NAMES = new Set(`className class id key ref style type name value defaultValue href src srcSet htmlFor
  role rel target method action d viewBox fill stroke transform points x y x1 x2 y1 y2 cx cy r rx ry width height
  textAnchor dominantBaseline fontFamily fontWeight fontSize fontStyle font strokeLinecap strokeLinejoin
  strokeDasharray strokeWidth clipPath mask filter xmlns lang dir inputMode autoComplete autoCapitalize pattern
  accept loading decoding preload crossOrigin as kind variant size color position rotation scale args attach
  anchorX anchorY tabIndex min max step mode display cursor transition animation easing ease background
  border margin padding overflow opacity zIndex top left right bottom gap flex grid align justify weight family
  locale timeZone month day year hour minute weekday currency unit event status state field tag selector
  path url endpoint table column schema provider scope format encoding credentials cache redirect
  cssText innerHTML outerHTML nodeName tagName dataset download`.split(/\s+/))
// As a property in a list of things ({ name: 'Top boards' }) these do hold wording
const DATA_KEYS = new Set(['name', 'value', 'state', 'unit', 'kind', 'status'])
const COPY_ATTRS = new Set(['aria-label', 'ariaLabel', 'title', 'placeholder', 'alt', 'label', 'summary', 'hint', 'note',
  'heading', 'caption', 'text', 'textContent', 'innerText', 'noun', 'detail', 'message', 'description', 'tooltip', 'emptyText'])
// Calls whose text arguments are never shown to anyone
const CODE_CALLS = new Set(`querySelector querySelectorAll getElementById getElementsByClassName closest matches
  getAttribute removeAttribute hasAttribute addEventListener removeEventListener add remove toggle contains
  createElement createElementNS getItem setItem removeItem readStorage writeStorage noteLocalChange log warn error
  info debug includes startsWith endsWith indexOf split replace replaceAll match test padStart padEnd matchMedia
  getContext toLocaleDateString toLocaleString toLocaleTimeString has get set delete fetch from rpc select eq on
  emit dispatchEvent require getPropertyValue setProperty removeProperty animate open import useLoader load
  encode decode digest key insert update upsert order filter channel subscribe register postMessage
  CustomEvent Event URL URLSearchParams RegExp Intl NumberFormat DateTimeFormat Blob File`.split(/\s+/))
const TRANSPARENT = new Set(['ConditionalExpression', 'LogicalExpression', 'TemplateLiteral', 'ArrayExpression',
  'SequenceExpression', 'ParenthesizedExpression'])
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration', 'ObjectMethod', 'ClassMethod'])
const JSX_ROLE = {
  button: 'Button', h1: 'Main heading', h2: 'Heading', h3: 'Subheading', h4: 'Subheading', label: 'Label',
  option: 'Menu option', th: 'Table heading', td: 'Table cell', p: 'Paragraph', li: 'List item', a: 'Link',
  text: 'Drawing label', tspan: 'Drawing label', Text: '3D label', summary: 'Heading', legend: 'Label', strong: 'Bold text', b: 'Bold text'
}

const isCodeAttr = (name) => CODE_NAMES.has(name) || name.startsWith('data-') || /^on[A-Z]/.test(name)
  || (name.startsWith('aria-') && !['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'aria-placeholder'].includes(name))
// On the app's own components (<Fold title="...">) a title is a heading, not a hover tip
const attrRole = (name, opening) => /^[A-Z]/.test(jsxName(opening?.name)) && name === 'title' ? 'Heading'
  : HTML_ATTR_ROLE[name] || sentence(humanise(name))

const jsxName = (node) => node?.type === 'JSXIdentifier' ? node.name
  : node?.type === 'JSXMemberExpression' ? `${jsxName(node.object)}.${jsxName(node.property)}`
  : node?.type === 'JSXNamespacedName' ? `${node.namespace.name}:${node.name.name}` : ''

/** How JSX itself reads text between tags: lines are trimmed and joined with single spaces. */
export function cleanJsxText(value) {
  const lines = value.split(/\r\n|\n|\r/)
  let lastNonEmpty = 0
  lines.forEach((line, i) => { if (/[^ \t]/.test(line)) lastNonEmpty = i })
  let out = ''
  lines.forEach((line, i) => {
    let trimmed = line.replace(/\t/g, ' ')
    if (i !== 0) trimmed = trimmed.replace(/^ +/, '')
    if (i !== lines.length - 1) trimmed = trimmed.replace(/ +$/, '')
    if (trimmed) out += i !== lastNonEmpty ? `${trimmed} ` : trimmed
  })
  return out
}

/** Does this string read as wording, or as a class name, selector, path or other code? */
export function looksLikeCopy(text, context) {
  const t = text.replace(/\u0001/g, ' \u0001 ').replace(/\s+/g, ' ').trim()
  const bare = text.replace(/\u0001/g, '').trim()
  if (!/[A-Za-z]{2,}/.test(bare)) return false
  if (/^[.#[@]/.test(bare) || /^(https?:|mailto:|tel:|data:|blob:|\.{0,2}\/)/.test(bare)) return false
  if (/\d(px|rem|em|ch|ms|vh|vw|deg|fr)\b/.test(bare)) return false
  if (/\b(calc|translate[XYZ3d]*|rotate[XYZ]?|scale[XY]?|rgba?|hsla?|var|url|matrix|cubic-bezier|min|max|clamp)\(/.test(bare)) return false
  if (/<\/?[a-z][^>]*>|=>|&&|\|\||[a-z-]+:\s*[^;:]+;/.test(bare)) return false
  if (/\b(sans-serif|serif|monospace)\b/.test(bare)) return false
  if (/\w=\w/.test(bare) || /\.(pdf|png|jpe?g|webp|svg|json|jsx?|css|html?|woff2?|mp4|webm)\b/i.test(bare)) return false
  if (/^[MmLlHhVvCcSsQqTtAaZz][\d\s.,\-MmLlHhVvCcSsQqTtAaZz]*$/.test(bare) && /\d/.test(bare)) return false
  if (/^[\w$]+(\.[\w$]+)+$/.test(bare) || /^[a-z0-9]+([-_:/][A-Za-z0-9]+)+$/.test(bare)) return false
  const words = t.split(' ').filter(w => w !== '\u0001')
  const several = t.split(' ').length > 1 && words.some(w => /[A-Za-z]{2,}/.test(w))
  if (several) {
    // "quote-item current" is a list of class names; "top boards and bearers" is wording
    if (context === 'code' && /^[a-z0-9_\- ]+$/.test(bare) && /[-_]/.test(bare)) return false
    if (context === 'code' && words.every(w => /^[a-z][a-zA-Z0-9]*$/.test(w)) && words.some(w => /[a-z][A-Z]/.test(w))) return false
    return true
  }
  if (context === 'child' || context === 'copy-attr') return true
  return /^[A-Z][a-z]{2,}[.!?:…]?$/.test(bare)
}

export function scanJs(file, source) {
  const ast = parseJs(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false })
  const segments = []
  const imports = []

  const add = (seg) => {
    seg.file = file
    seg.plain = plainOf(seg.nodes)
    if (!hasWord(seg.plain)) return
    seg.id = `${file}:${seg.start}:${hash(source.slice(seg.start, seg.end))}`
    segments.push(seg)
  }

  const srcOf = (node) => source.slice(node.start, node.end)

  // What each tab is called on screen: { id: 'calculator', label: 'Build' }
  const tabNames = new Map()
  for (const m of source.matchAll(/\{\s*id:\s*'([\w-]+)',\s*label:\s*'([^']+)'/g)) tabNames.set(m[1], m[2])

  // A short name for a live value shown in the middle of a sentence
  const tokenLabel = (expr) => {
    switch (expr.type) {
      case 'Identifier': return humanise(expr.name)
      case 'MemberExpression':
      case 'OptionalMemberExpression':
        return expr.computed ? tokenLabel(expr.object) : humanise(expr.property.name || '')
      case 'CallExpression':
      case 'OptionalCallExpression': {
        const inner = expr.arguments[0]
        const callee = expr.callee
        // "q.status.toLowerCase()" is still the status; "formatCurrency(total)" is still the total
        if (callee.type !== 'Identifier') {
          if (!callee.object) return 'value'
          const builtIn = callee.object.type === 'Identifier' && ['Math', 'Number', 'String', 'JSON', 'Object'].includes(callee.object.name)
          return builtIn && inner ? tokenLabel(inner) : tokenLabel(callee.object)
        }
        if (inner && inner.type !== 'StringLiteral' && (callee.name.length < 4 || /^(format|money|round|String|parse|Number)/i.test(callee.name))) return tokenLabel(inner)
        return humanise(callee.name)
      }
      case 'TemplateLiteral': return 'text'
      case 'ConditionalExpression': {
        const a = expr.consequent, b = expr.alternate
        if (a.type === 'StringLiteral' && b.type === 'StringLiteral') {
          if (!a.value.trim() || !b.value.trim()) return `(${(a.value + b.value).trim()})`
          return `${a.value.trim()} / ${b.value.trim()}`
        }
        return 'depends'
      }
      case 'LogicalExpression': return expr.operator === '&&' ? 'depends' : tokenLabel(expr.left)
      default: return 'value'
    }
  }

  // Where in the app this text sits: the tab, and the named piece of the component it belongs to
  const groupOf = (ancestors) => {
    const names = []
    let tab = ''
    for (const node of ancestors) {
      if (node.type === 'FunctionDeclaration' && node.id) names.push(node.id.name)
      else if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') names.push(node.id.name)
      else if (node.type === 'LogicalExpression' && node.operator === '&&' && node.left.type === 'BinaryExpression'
        && node.left.operator === '===' && node.left.right.type === 'StringLiteral' && /tab/i.test(srcOf(node.left.left))) {
        tab = node.left.right.value
      }
    }
    const main = path.basename(file).replace(/\.[^.]+$/, '')
    const top = names[0]
    const second = names[1]
    if (tab) return `${tabNames.get(tab) || sentence(humanise(tab))} tab`
    if (!top) return 'General'
    if (top === main || /^[A-Z]/.test(top) && second) return second ? sentence(humanise(second)) : 'Main screen'
    return sentence(humanise(top))
  }

  const jsxRole = (ancestors) => {
    for (let i = ancestors.length - 1, depth = 0; i >= 0 && depth < 6; i--) {
      const node = ancestors[i]
      if (node.type !== 'JSXElement') continue
      depth++
      const name = jsxName(node.openingElement.name)
      if (JSX_ROLE[name]) return JSX_ROLE[name]
      const cls = node.openingElement.attributes.find(a => a.name?.name === 'className')?.value?.value || ''
      if (/label/.test(cls)) return 'Label'
      if (/btn|button/.test(cls)) return 'Button'
      if (/note|hint|help/.test(cls)) return 'Note'
    }
    return 'Text'
  }

  /* ---- text between tags ---- */

  const isInlineJsx = (node) => {
    if (node.type === 'JSXText') return true
    if (node.type === 'JSXExpressionContainer') return node.expression.type !== 'JSXEmptyExpression'
    if (node.type !== 'JSXElement') return false
    const name = jsxName(node.openingElement.name)
    if (!INLINE.has(name)) return false
    return node.children.every(isInlineJsx)
  }
  const isSpace = (node) => node.type === 'JSXExpressionContainer' && node.expression.type === 'StringLiteral' && !node.expression.value.trim()
  const jsxHasText = (node) => node.type === 'JSXText' ? hasWord(node.value)
    : node.type === 'JSXElement' ? node.children.some(jsxHasText) : false

  const insideRun = new Set()
  const emitJsxRun = (items, ancestors) => {
    while (items.length && isSpace(items[0])) items = items.slice(1)
    while (items.length && isSpace(items[items.length - 1])) items = items.slice(0, -1)
    if (!items.some(jsxHasText)) return
    const keys = []
    const build = (node) => {
      if (node.type === 'JSXText') return { t: 'text', v: cleanJsxText(node.value) }
      if (isSpace(node)) return { t: 'text', v: ' ' }
      if (node.type === 'JSXExpressionContainer') {
        keys.push({ range: [node.start, node.end] })
        return { t: 'tok', k: keys.length - 1, label: tokenLabel(node.expression), title: `Filled in by the app: ${clip(collapse(srcOf(node.expression)), 90)}` }
      }
      if (node.openingElement.selfClosing || !node.children.some(jsxHasText)) {
        keys.push({ range: [node.start, node.end] })
        const name = jsxName(node.openingElement.name)
        return { t: 'tok', k: keys.length - 1, label: name === 'br' ? 'line break' : name, title: 'Placed by the app. It stays as it is.' }
      }
      keys.push({ open: [node.openingElement.start, node.openingElement.end], close: [node.closingElement.start, node.closingElement.end] })
      const k = keys.length - 1
      insideRun.add(node)
      return { t: 'el', k, tag: jsxName(node.openingElement.name), children: node.children.map(build) }
    }
    const nodes = items.map(build)
    let start = items[0].start
    let end = items[items.length - 1].end
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (items[0].type === 'JSXText') {
      start += source.slice(start, items[0].end).match(/^\s*/)[0].length
      first.v = first.v.trimStart()
    }
    if (items[items.length - 1].type === 'JSXText') {
      end -= source.slice(items[items.length - 1].start, end).match(/\s*$/)[0].length
      last.v = last.v.trimEnd()
    }
    if (end <= start) return
    add({ kind: 'jsx-run', role: jsxRole(ancestors), group: groupOf(ancestors), variants: [], start, end, nodes: nodes.filter(n => n.t !== 'text' || n.v), keys })
  }

  const scanJsxChildren = (node, ancestors) => {
    if (insideRun.has(node) || !node.children.some(c => c.type === 'JSXText' && hasWord(c.value))) return
    let run = []
    const flush = () => { if (run.length) emitJsxRun(run, ancestors); run = [] }
    for (const child of node.children) {
      if (isInlineJsx(child)) run.push(child)
      else flush()
    }
    flush()
  }

  /* ---- strings in the code ---- */

  const calleeName = (call) => {
    const c = call.callee
    if (!c) return ''
    if (c.type === 'Identifier') return c.name
    if (c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') return c.property?.name || ''
    return ''
  }

  // Works out whether a string is shown to someone, and if so what kind of text it is
  const classifyString = (node, ancestors) => {
    let i = ancestors.length - 1
    let child = node
    // Step out through "a ? b : c", "a || b" and the like to whatever the result is used for
    while (i >= 0) {
      const p = ancestors[i]
      if (TRANSPARENT.has(p.type)) {
        if (p.type === 'ConditionalExpression' && p.test === child) return null
        child = p; i--
      } else if (p.type === 'BinaryExpression' && p.operator === '+') { child = p; i--
      } else break
    }
    const host = ancestors[i]
    if (!host) return null
    let role = 'Message'
    let context = 'code'
    switch (host.type) {
      case 'ImportDeclaration': case 'ExportAllDeclaration': case 'ExportNamedDeclaration': case 'ImportExpression':
      case 'TaggedTemplateExpression': case 'SwitchCase': case 'Directive': case 'TSLiteralType':
        return null
      case 'BinaryExpression':
        return null
      case 'MemberExpression': case 'OptionalMemberExpression':
        if (host.property === child) return null
        break
      case 'ObjectProperty': {
        if (host.key === child && !host.computed) return null
        const key = host.key.name || host.key.value
        if ((CODE_NAMES.has(key) && !DATA_KEYS.has(key)) || /^(data|aria)[A-Z-]/.test(key || '') && key !== 'ariaLabel') return null
        role = sentence(humanise(key || 'text'))
        if (COPY_ATTRS.has(key)) context = 'copy-attr'
        break
      }
      case 'AssignmentExpression': {
        if (host.left === child) return null
        const left = host.left
        const key = left.type === 'Identifier' ? left.name : left.property?.name
        if (CODE_NAMES.has(key)) return null
        if (COPY_ATTRS.has(key)) { context = 'copy-attr'; role = sentence(humanise(key)) }
        break
      }
      case 'CallExpression': case 'OptionalCallExpression': case 'NewExpression': {
        const name = calleeName(host)
        const index = host.arguments.indexOf(child)
        if (name === 'setAttribute') {
          const attr = host.arguments[0]?.value
          if (index !== 1 || !COPY_ATTRS.has(attr)) return null
          context = 'copy-attr'; role = HTML_ATTR_ROLE[attr] || sentence(humanise(attr))
        } else if (CODE_CALLS.has(name)) return null
        else if (name === 'alert' || name === 'confirm' || name === 'prompt') role = 'Pop-up message'
        else if (name === 'Error') role = 'Error message'
        break
      }
      case 'JSXAttribute': {
        const name = jsxName(host.name)
        if (isCodeAttr(name)) return null
        context = COPY_ATTRS.has(name) ? 'copy-attr' : 'attr'
        role = attrRole(name, ancestors[i - 1])
        break
      }
      case 'JSXExpressionContainer': {
        const outer = ancestors[i - 1]
        if (outer?.type === 'JSXAttribute') {
          const name = jsxName(outer.name)
          if (isCodeAttr(name)) return null
          context = COPY_ATTRS.has(name) ? 'copy-attr' : 'attr'
          role = attrRole(name, ancestors[i - 2])
        } else {
          context = 'child'
          role = jsxRole(ancestors.slice(0, i))
        }
        break
      }
      default:
    }
    // Anything inside a class list, a style or another code-only attribute is code, however it reads
    for (let j = i, inner = child; j >= 0; inner = ancestors[j], j--) {
      const a = ancestors[j]
      if (FUNCTIONS.has(a.type)) break
      if (a.type === 'JSXAttribute') {
        const name = jsxName(a.name)
        if (isCodeAttr(name)) return null
        break
      }
      if ((a.type === 'CallExpression' || a.type === 'NewExpression') && a.arguments.includes(inner)
        && CODE_CALLS.has(calleeName(a)) && calleeName(a) !== 'setAttribute') return null
    }
    return { role, context }
  }

  const scanString = (node, ancestors) => {
    const found = classifyString(node, ancestors)
    if (!found) return
    const parent = ancestors[ancestors.length - 1]
    if (node.type === 'StringLiteral') {
      if (!looksLikeCopy(node.value, found.context)) return
      const value = node.value
      const lead = value.match(/^\s*/)[0], trail = value.slice(lead.length).match(/\s*$/)[0]
      add({
        kind: parent.type === 'JSXAttribute' ? 'jsx-attr' : 'string', role: found.role, group: groupOf(ancestors), variants: [],
        start: node.start + 1, end: node.end - 1, quote: source[node.start], lead, trail,
        nodes: [{ t: 'text', v: value.slice(lead.length, value.length - trail.length) }], keys: []
      })
      return
    }
    const joined = node.quasis.map(q => q.value.cooked ?? '').join('\u0001')
    if (!looksLikeCopy(joined, found.context)) return
    const keys = []
    const nodes = []
    node.quasis.forEach((quasi, n) => {
      if (quasi.value.cooked) nodes.push({ t: 'text', v: quasi.value.cooked })
      const expr = node.expressions[n]
      if (expr) {
        // The chip covers the whole `${...}`, so the value can be moved within the sentence
        keys.push({ range: [quasi.end, node.quasis[n + 1].start] })
        nodes.push({ t: 'tok', k: keys.length - 1, label: tokenLabel(expr), title: `Filled in by the app: ${clip(collapse(srcOf(expr)), 90)}` })
      }
    })
    let lead = '', trail = ''
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (first?.t === 'text') { lead = first.v.match(/^\s*/)[0]; first.v = first.v.slice(lead.length) }
    if (last?.t === 'text') { trail = last.v.match(/\s*$/)[0]; last.v = last.v.slice(0, last.v.length - trail.length) }
    add({
      kind: 'template', role: found.role, group: groupOf(ancestors), variants: [],
      start: node.start + 1, end: node.end - 1, lead, trail,
      nodes: nodes.filter(n => n.t !== 'text' || n.v), keys
    })
  }

  /* ---- walk the whole file ---- */

  const visit = (node, ancestors) => {
    if (!node || typeof node.type !== 'string') return
    switch (node.type) {
      case 'ImportDeclaration': case 'ExportAllDeclaration': case 'ExportNamedDeclaration': {
        if (!node.source) break
        // A component that is imported but never used isn't on screen, so its text isn't listed
        const locals = node.type === 'ImportDeclaration' ? node.specifiers.map(sp => sp.local.name) : []
        const rest = source.slice(0, node.start) + source.slice(node.end)
        const used = !locals.length || locals.some(name => rest.split(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`)).length > 1)
        if (used) imports.push(node.source.value)
        break
      }
      case 'ImportExpression':
        if (node.source?.type === 'StringLiteral') imports.push(node.source.value)
        break
      case 'CallExpression':
        if (node.callee.type === 'Import' && node.arguments[0]?.type === 'StringLiteral') imports.push(node.arguments[0].value)
        break
      case 'JSXElement': case 'JSXFragment':
        scanJsxChildren(node, [...ancestors, node])
        break
      case 'StringLiteral':
        scanString(node, ancestors)
        return
      case 'TemplateLiteral':
        scanString(node, ancestors)
        break
      default:
    }
    const next = [...ancestors, node]
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'extra' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue
      const value = node[key]
      if (Array.isArray(value)) for (const item of value) visit(item, next)
      else if (value && typeof value.type === 'string') visit(value, next)
    }
  }
  visit(ast.program, [])

  segments.sort((a, b) => a.start - b.start || b.end - a.end)
  return { segments, imports }
}

/* ------------------------------------------------------------------ JSON (the install details) */

const MANIFEST_ROLE = { name: 'App name', short_name: 'Home screen name', description: 'Description' }

export function scanManifest(file, source) {
  const segments = []
  const pattern = /"(name|short_name|description)"\s*:\s*"((?:[^"\\]|\\.)*)"/g
  let match
  while ((match = pattern.exec(source))) {
    let value
    try { value = JSON.parse(`"${match[2]}"`) } catch { continue }
    const start = match.index + match[0].length - 1 - match[2].length
    const seg = {
      file, kind: 'json', role: MANIFEST_ROLE[match[1]], group: 'When installed on a phone or computer', variants: [],
      start, end: start + match[2].length, nodes: [{ t: 'text', v: value }], keys: [], plain: value
    }
    seg.id = `${file}:${seg.start}:${hash(source.slice(seg.start, seg.end))}`
    if (hasWord(value)) segments.push(seg)
  }
  return segments
}

/* ------------------------------------------------------------------ writing an edit back */

const ESCAPE = {
  'html-run': (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;'),
  'html-attr': (t, seg) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, '&nbsp;')
    .replace(seg.quote === "'" ? /'/g : /"/g, seg.quote === "'" ? '&#39;' : '&quot;'),
  'jsx-run': (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;'),
  'jsx-attr': (t, seg) => t.replace(/&/g, '&amp;').replace(seg.quote === "'" ? /'/g : /"/g, seg.quote === "'" ? '&#39;' : '&quot;'),
  string: (t, seg) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    .split(seg.quote).join(`\\${seg.quote}`),
  template: (t) => t.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'),
  json: (t) => JSON.stringify(t).slice(1, -1)
}

function tidy(nodes, kind) {
  // What the browser hands back can hold stray line breaks and doubled spaces; wording never needs them
  // Between tags, runs of spaces mean nothing. In a label or message they are kept exactly as typed
  // (the drawing's title block spaces its words out on purpose).
  const exact = !kind.endsWith('-run')
  const clean = (list) => list.map(n => {
    if (n.t === 'text') return { t: 'text', v: exact ? String(n.v).replace(/[\r\n]+/g, ' ') : collapse(String(n.v)) }
    if (n.t === 'el') return { ...n, children: clean(n.children || []) }
    return n
  })
  const out = clean(nodes)
  const edge = (list, side) => {
    const node = list[side === 'start' ? 0 : list.length - 1]
    if (node?.t === 'text') node.v = side === 'start' ? node.v.trimStart() : node.v.trimEnd()
  }
  edge(out, 'start'); edge(out, 'end')
  return out.filter(n => n.t !== 'text' || n.v)
}

/**
 * Apply edits to one file's source. Each edit is `{ id, nodes }`, where `nodes` is the display
 * tree as changed in the editor. Returns the new source, or throws with a reason nothing was written.
 */
export function applyEdits(file, source, edits, scan = scanFile) {
  const segments = scan(file, source).segments
  const byId = new Map(segments.map(s => [s.id, s]))
  const jobs = []
  for (const edit of edits) {
    const seg = byId.get(edit.id)
    if (!seg) throw Object.assign(new Error('This text has changed in the file since the editor loaded it.'), { stale: true, id: edit.id })
    jobs.push({ seg, nodes: tidy(edit.nodes, seg.kind) })
  }
  jobs.sort((a, b) => a.seg.start - b.seg.start || b.seg.end - a.seg.end)

  // Rebuild a stretch of the file, swapping in any edits that fall inside it
  const topLevel = (from, to, pool) => {
    const inside = pool.filter(j => j.seg.start >= from && j.seg.end <= to)
    const top = inside.filter(j => !inside.some(o => o !== j && o.seg.start <= j.seg.start && o.seg.end >= j.seg.end))
    return { inside, top }
  }
  const render = (from, to, pool) => {
    let out = ''
    let at = from
    const { inside, top } = topLevel(from, to, pool)
    for (const job of top) {
      out += source.slice(at, job.seg.start) + build(job, inside.filter(j => j !== job))
      at = job.seg.end
    }
    return out + source.slice(at, to)
  }

  const build = (job, pool) => {
    const { seg } = job
    const escape = (text) => ESCAPE[seg.kind](text, seg)
    const used = new Set()
    job.used = used
    const key = (k) => {
      const found = seg.keys[k]
      if (!found || used.has(k)) throw new Error('Part of this text could not be matched to the file. Reload the editor and try again.')
      used.add(k)
      return found
    }
    const emit = (list) => list.map(n => {
      if (n.t === 'text') return escape(n.v)
      if (n.t === 'tok') { const k = key(n.k); return render(k.range[0], k.range[1], pool) }
      const k = key(n.k)
      return render(k.open[0], k.open[1], pool) + emit(n.children || []) + source.slice(k.close[0], k.close[1])
    }).join('')
    const body = emit(job.nodes)
    if (seg.kind === 'string' || seg.kind === 'jsx-attr' || seg.kind === 'template') return escape(seg.lead || '') + body + escape(seg.trail || '')
    return body
  }

  const next = render(0, source.length, jobs)
  verify(file, source, next, jobs, topLevel)
  return next
}

const CODE_TOKEN = (t) => !['string', 'template', 'jsxText'].includes(t.type.label)
const codeTokens = (text) => parseJs(text, { sourceType: 'module', plugins: ['jsx'], tokens: true }).tokens.filter(CODE_TOKEN)
  .map(t => ({ start: t.start, end: t.end, sig: `${t.type.label}:${t.value ?? ''}` }))
const countElements = (node) => (node.tagName ? 1 : 0)
  + (node.childNodes || []).reduce((n, c) => n + countElements(c), 0)
  + (node.content ? countElements(node.content) : 0)

// The file must still be the same code and the same page structure, with different words in it.
// The only pieces allowed to go are the bold text, links and live values taken out of a sentence on purpose.
function verify(file, before, after, jobs, topLevel) {
  if (/\.(jsx?|mjs)$/.test(file)) {
    const tokens = codeTokens(before)
    const within = (a, b) => tokens.filter(t => t.start >= a && t.end <= b)
    const expect = (from, to, pool) => {
      const out = []
      let at = from
      const { inside, top } = topLevel(from, to, pool)
      for (const job of top) {
        out.push(...within(at, job.seg.start))
        const rest = inside.filter(j => j !== job)
        const walk = (list) => {
          for (const n of list) {
            const k = job.seg.keys[n.k]
            if (n.t === 'tok') out.push(...expect(k.range[0], k.range[1], rest))
            else if (n.t === 'el') { out.push(...expect(k.open[0], k.open[1], rest)); walk(n.children || []); out.push(...within(k.close[0], k.close[1])) }
          }
        }
        walk(job.nodes)
        at = job.seg.end
      }
      out.push(...within(at, to))
      return out
    }
    const wanted = expect(0, before.length, jobs).map(t => t.sig).join('\u0001')
    let got
    try { got = codeTokens(after).map(t => t.sig).join('\u0001') } catch { got = null }
    if (wanted !== got) throw new Error('That change would have altered the code around the text, so nothing was saved.')
  } else if (/\.html?$/.test(file)) {
    let removed = 0
    for (const job of jobs) {
      if (!job.used) continue
      job.seg.keys.forEach((k, index) => {
        if (job.used.has(index)) return
        removed += k.range ? countElements(parseFragment(before.slice(k.range[0], k.range[1]))) : 1
      })
    }
    const count = (text) => countElements(parseHtml(text, { scriptingEnabled: false }))
    if (count(before) - removed !== count(after)) throw new Error('That change would have altered the page structure, so nothing was saved.')
  } else if (/\.json$/.test(file)) {
    JSON.parse(after)
  }
}

export function scanFile(file, source) {
  if (/\.html?$/.test(file)) return { segments: scanHtml(file, source), imports: [] }
  if (/\.json$/.test(file)) return { segments: scanManifest(file, source), imports: [] }
  return scanJs(file, source)
}

/* ------------------------------------------------------------------ the whole site */

const PDF_FILES = /(PrintableQuote|ShopDrawing)\.jsx?$/

function resolveImport(root, from, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null
  const base = spec.startsWith('/') ? path.join(root, spec) : path.resolve(root, path.dirname(from), spec)
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) {
    if (/\.(jsx?|mjs)$/.test(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(root, candidate).split(path.sep).join('/')
    }
  }
  return null
}

const cache = new Map()
function scanCached(root, file) {
  const full = path.join(root, file)
  const stat = fs.statSync(full)
  const stamp = `${stat.mtimeMs}:${stat.size}`
  const hit = cache.get(full)
  if (hit?.stamp === stamp) return hit.result
  const source = fs.readFileSync(full, 'utf8')
  let result
  try { result = scanFile(file, source) } catch (error) { result = { segments: [], imports: [], error: error.message } }
  if (/\.html?$/.test(file)) {
    // The scripts a page loads decide which code files belong to it
    const scripts = [...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m => m[1])
    result.imports = scripts
  }
  cache.set(full, { stamp, result })
  return result
}

/**
 * Scan the site. `pages` are the HTML entry files, relative to `root` (taken from the Vite config,
 * so a page added there is picked up without touching this tool).
 */
export function scanSite(root, pages) {
  const areas = []
  const owner = new Map()   // code file -> the pages that load it
  const order = []
  const problems = []

  const pageName = (file) => {
    const dir = path.dirname(file)
    if (dir === '.') return 'Landing page'
    if (dir === 'app') return 'Calculator app'
    return sentence(humanise(dir).replace(/^v(\d+)$/, 'landing page v$1'))
  }

  for (const page of pages) {
    const scanned = scanCached(root, page)
    if (scanned.error) problems.push({ file: page, error: scanned.error })
    areas.push({ id: page, name: pageName(page), preview: page, files: [page], segments: [...scanned.segments] })
    const queue = scanned.imports.map(spec => resolveImport(root, page, spec)).filter(Boolean)
    const seen = new Set()
    while (queue.length) {
      const file = queue.shift()
      if (seen.has(file) || /\.test\./.test(file)) continue
      seen.add(file)
      if (!owner.has(file)) { owner.set(file, []); order.push(file) }
      owner.get(file).push(page)
      const result = scanCached(root, file)
      if (result.error) { if (!problems.some(p => p.file === file)) problems.push({ file, error: result.error }); continue }
      for (const spec of result.imports) {
        const next = resolveImport(root, file, spec)
        if (next) queue.push(next)
      }
    }
  }

  const area = (id, name, preview) => {
    let found = areas.find(a => a.id === id)
    if (!found) { found = { id, name, preview, files: [], segments: [] }; areas.push(found) }
    return found
  }
  for (const file of order) {
    const { segments } = scanCached(root, file)
    if (!segments.length) continue
    const pagesUsing = owner.get(file)
    const label = path.basename(file)
    let target
    if (PDF_FILES.test(file)) target = area('pdf', 'Quote PDFs', null)
    else if (pagesUsing.includes('app/index.html')) target = area('app/index.html', 'Calculator app', 'app/index.html')
    else if (pagesUsing.length === 1) target = areas.find(a => a.id === pagesUsing[0])
    else target = area('shared', 'Shared by several pages', null)
    target.files.push(file)
    const scripted = target.id !== 'pdf' && target.id !== 'app/index.html'
    for (const seg of segments) {
      target.segments.push(scripted ? { ...seg, group: `Set by script: ${seg.group} (${label})` } : PDF_FILES.test(file)
        ? { ...seg, group: `${/Shop/.test(file) ? 'Drawing' : 'Quote'}: ${seg.group}` } : seg)
    }
  }

  const manifest = 'public/manifest.json'
  if (fs.existsSync(path.join(root, manifest))) {
    const { segments } = scanCached(root, manifest)
    const app = areas.find(a => a.id === 'app/index.html')
    if (app && segments.length) { app.files.push(manifest); app.segments.push(...segments) }
  }

  return { areas: areas.filter(a => a.segments.length), problems }
}

/** The scan as the editor page receives it: grouped, in page order, without file offsets. */
export function siteView(root, pages) {
  const { areas, problems } = scanSite(root, pages)
  const ids = []
  const view = areas.map(a => {
    const groups = []
    for (const seg of a.segments) {
      ids.push(seg.id)
      let group = groups[groups.length - 1]
      if (!group || group.name !== seg.group) {
        group = groups.find(g => g.name === seg.group && g.file === seg.file)
        if (!group) { group = { name: seg.group, file: seg.file, items: [] }; groups.push(group) }
      }
      group.items.push(publicView(seg))
    }
    // What is laid out on screen comes first, in order; messages raised from the code follow
    const onScreen = (g) => g.items.some(item => !['string', 'template'].includes(item.kind))
    groups.sort((x, y) => Number(onScreen(y)) - Number(onScreen(x)))
    return { id: a.id, name: a.name, preview: a.preview, files: a.files, groups }
  })
  return { areas: view, problems, version: hash(ids.join('|')) }
}

/** Save a batch of edits from the editor. Nothing is written unless every file comes out valid. */
export function saveEdits(root, pages, edits) {
  const { areas } = scanSite(root, pages)
  const fileOf = new Map()
  for (const a of areas) for (const seg of a.segments) fileOf.set(seg.id, seg.file)
  const perFile = new Map()
  for (const edit of edits) {
    const file = fileOf.get(edit.id)
    if (!file) throw Object.assign(new Error('Some of this text has changed in the files since the editor loaded it.'), { stale: true, id: edit.id })
    if (!perFile.has(file)) perFile.set(file, [])
    perFile.get(file).push(edit)
  }
  const outputs = []
  for (const [file, list] of perFile) {
    const full = path.join(root, file)
    const source = fs.readFileSync(full, 'utf8')
    const next = applyEdits(file, source, list)
    if (next !== source) outputs.push({ file, full, next })
  }
  for (const out of outputs) {
    const temp = `${out.full}.copy-editor.tmp`
    fs.writeFileSync(temp, out.next)
    fs.renameSync(temp, out.full)
  }
  return outputs.map(o => o.file)
}
