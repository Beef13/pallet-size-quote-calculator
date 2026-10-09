import { describe, it, expect } from 'vitest'
import { scanHtml, scanJs, scanManifest, applyEdits, looksLikeCopy, cleanJsxText, plainOf } from './scan.js'

const text = (v) => ({ t: 'text', v })
const find = (segments, plain) => {
  const seg = segments.find(s => s.plain === plain)
  if (!seg) throw new Error(`No text "${plain}" in: ${segments.map(s => s.plain).join(' | ')}`)
  return seg
}

describe('finding wording in a page', () => {
  const page = `<!doctype html><html><head>
    <title>Pallets: quotes</title>
    <meta name="description" content="Quote &amp; draw" />
  </head><body>
    <section id="hero">
      <h1><span aria-hidden="true">x</span><span>Fast quotes.</span> <span>Drawn to scale.</span></h1>
      <p class="lede">Costs every board
        by the <strong>metre</strong>, see <a href="/terms" title="Read them">the terms</a>.</p>
      <p><span data-billing="off">Free for now.</span><span data-billing="on">Free to start.</span> No install.</p>
      <button><svg viewBox="0 0 1 1"><path d="M0 0"/></svg>Expand view</button>
      <p>Run by <span data-op="name"></span> in Victoria.</p>
      <script>var hidden = 'Not wording'</script>
    </section>
  </body></html>`
  const segments = scanHtml('index.html', page)

  it('lists text in page order, with what kind of text it is', () => {
    expect(find(segments, 'Pallets: quotes').role).toBe('Browser tab title')
    expect(find(segments, 'Quote & draw').role).toBe('Search result description')
    expect(find(segments, 'Fast quotes.').role).toBe('Main heading')
    expect(find(segments, 'Expand view').role).toBe('Button')
    expect(segments.some(s => s.plain.includes('Not wording'))).toBe(false)
    const order = segments.map(s => s.plain)
    expect(order.indexOf('Fast quotes.')).toBeLessThan(order.indexOf('Drawn to scale.'))
  })

  it('groups text under the section it sits in', () => {
    expect(find(segments, 'Expand view').group).toBe('Fast quotes. Drawn to scale.')
    expect(find(segments, 'Pallets: quotes').group).toBe('Search and sharing')
  })

  it('keeps a sentence with bold text and a link as one piece', () => {
    const seg = find(segments, 'Costs every board by the metre, see the terms.')
    expect(seg.nodes.map(n => n.t)).toEqual(['text', 'el', 'text', 'el', 'text'])
    expect(seg.nodes[1].tag).toBe('strong')
  })

  it('keeps the two versions of a passage apart', () => {
    expect(find(segments, 'Free for now.').variants).toEqual(['billing off'])
    expect(find(segments, 'Free to start.').variants).toEqual(['billing on'])
    expect(find(segments, 'No install.').variants).toEqual([])
  })

  it('shows a value the page fills in as a fixed marker', () => {
    const seg = find(segments, 'Run by  in Victoria.')
    expect(seg.nodes[1]).toMatchObject({ t: 'tok', label: 'name' })
  })

  it('writes an edit back without touching anything around it', () => {
    const seg = find(segments, 'Costs every board by the metre, see the terms.')
    const nodes = [text('Prices each board by the '), { ...seg.nodes[1], children: [text('lineal metre')] }, text(' <fast> & see '), seg.nodes[3], text('!')]
    const next = applyEdits('index.html', page, [{ id: seg.id, nodes }])
    expect(next).toContain('<p class="lede">Prices each board by the <strong>lineal metre</strong> &lt;fast&gt; &amp; see <a href="/terms" title="Read them">the terms</a>!</p>')
    expect(next.replace(/<p class="lede">.*?<\/p>/s, '')).toBe(page.replace(/<p class="lede">.*?<\/p>/s, ''))
  })

  it('saves an edit inside a link and an edit to the sentence around it together', () => {
    const sentence = find(segments, 'Costs every board by the metre, see the terms.')
    const tip = find(segments, 'Read them')
    const next = applyEdits('index.html', page, [
      { id: tip.id, nodes: [text('Read "them" now')] },
      { id: sentence.id, nodes: [text('See '), sentence.nodes[3]] }
    ])
    expect(next).toContain('<p class="lede">See <a href="/terms" title="Read &quot;them&quot; now">the terms</a></p>')
  })

  it('refuses an edit to text that has since changed in the file', () => {
    const seg = find(segments, 'Expand view')
    expect(() => applyEdits('index.html', page.replace('Expand view', 'Open'), [{ id: seg.id, nodes: [text('x')] }])).toThrow(/changed in the file/)
  })

  it('finds a section that is added later, with no change to the editor', () => {
    const more = page.replace('</section>', '</section><section><h2>Crates are next</h2><p>Coming soon.</p></section>')
    const found = scanHtml('index.html', more)
    expect(find(found, 'Coming soon.').group).toBe('Crates are next')
    expect(found.length).toBe(segments.length + 2)
  })
})

describe('finding wording in the app', () => {
  const code = `import { money } from './money'
const STATUS = { draft: 'Draft', sent: 'Sent' }
const tabs = [{ id: 'calculator', label: 'Build' }]
function timeAgo(n) { return n === 0 ? 'just now' : \`\${n} minute\${n === 1 ? '' : 's'} ago\` }
export default function App({ q, tab }) {
  const note = q.ok ? 'Ready to export.' : "It isn't ready"
  const total = money(q.total)
  if (q.status === 'draft') localStorage.setItem('palletQuotes', 'x y')
  return (
    <div className={\`panel \${tab === 'a' ? 'is open' : ''}\`} data-field="quote total">
      {tab === 'calculator' && (
        <section>
          <h2>Pallet size</h2>
          <label className="field-label">Boards {q.max}</label>
          <button title="Start again" aria-controls="panel-1" onClick={() => alert('Really clear it?')}>
            <Icon name="trash" /> Clear
          </button>
          <p>
            Delete {q.number}? This <b>can't</b> be undone.
          </p>
          <option value="">{q.type ? 'Choose size' : 'Choose timber first'}</option>
        </section>
      )}
    </div>
  )
}`
  const { segments, imports } = scanJs('src/App.jsx', code)
  const plains = segments.map(s => s.plain)

  it('lists the words people see', () => {
    for (const expected of ['Draft', 'Sent', 'Build', 'just now', 'Ready to export.', "It isn't ready", 'Pallet size', 'Boards ',
      'Start again', 'Really clear it?', 'Clear', 'Choose size', 'Choose timber first']) {
      expect(plains).toContain(expected)
    }
    expect(find(segments, 'Clear').role).toBe('Button')
    expect(find(segments, 'Really clear it?').role).toBe('Pop-up message')
    expect(find(segments, 'Start again').role).toBe('Hover tip')
  })

  it('leaves code alone: class names, storage keys, ids, comparisons, imports', () => {
    for (const code of ['draft', 'palletQuotes', 'x y', 'is open', 'panel ', 'quote total', 'panel-1', 'trash', 'calculator', './money', 'a']) {
      expect(plains).not.toContain(code)
    }
    expect(imports).toEqual(['./money'])
  })

  it('names the tab the text is on by what the tab is called on screen', () => {
    expect(find(segments, 'Pallet size').group).toBe('Build tab')
  })

  it('shows live values as markers inside the sentence', () => {
    const seg = segments.find(s => s.plain.startsWith('Delete '))
    expect(seg.nodes.map(n => n.t)).toEqual(['text', 'tok', 'text', 'el', 'text'])
    expect(seg.nodes[1].label).toBe('number')
    const ago = find(segments, ' minute ago')
    expect(ago.nodes.map(n => n.label || n.v)).toEqual(['n', ' minute', '(s)', ' ago'])
  })

  it('rewrites a sentence and keeps the live values and tags working', () => {
    const seg = segments.find(s => s.plain.startsWith('Delete '))
    const nodes = [text('Remove quote '), seg.nodes[1], text(' for good? {Really} it '), { ...seg.nodes[3], children: [text('cannot')] }, text(' be undone.')]
    const next = applyEdits('src/App.jsx', code, [{ id: seg.id, nodes }])
    expect(next).toContain("Remove quote {q.number} for good? &#123;Really&#125; it <b>cannot</b> be undone.")
    expect(scanJs('src/App.jsx', next).segments.map(s => s.plain)).toContain('Remove quote  for good? {Really} it cannot be undone.')
  })

  it('lets a live value or bold text be taken out of a sentence, and nothing else', () => {
    const seg = segments.find(s => s.plain.startsWith('Delete '))
    const next = applyEdits('src/App.jsx', code, [{ id: seg.id, nodes: [text('Delete this quote?')] }])
    expect(next).toMatch(/<p>\s+Delete this quote\?\s+<\/p>/)
    expect(next.replace(/<p>[^]*?<\/p>/, '')).toBe(code.replace(/<p>[^]*?<\/p>/, ''))
  })

  it('escapes quotes so the code stays valid', () => {
    const a = find(segments, 'Ready to export.')
    const b = find(segments, "It isn't ready")
    const c = find(segments, 'Start again')
    const d = find(segments, ' minute ago')
    const next = applyEdits('src/App.jsx', code, [
      { id: a.id, nodes: [text("It's ready \\ go")] },
      { id: b.id, nodes: [text('Say "not yet"')] },
      { id: c.id, nodes: [text('Start "fresh" & clean')] },
      { id: d.id, nodes: [d.nodes[0], text(' min'), d.nodes[2], text(' `back` ${then}')] }
    ])
    expect(next).toContain("'It\\'s ready \\\\ go'")
    expect(next).toContain('"Say \\"not yet\\""')
    expect(next).toContain('title="Start &quot;fresh&quot; &amp; clean"')
    expect(next).toContain("`${n} min${n === 1 ? '' : 's'} \\`back\\` \\${then}`")
    const again = scanJs('src/App.jsx', next).segments.map(s => s.plain)
    expect(again).toEqual(expect.arrayContaining(["It's ready \\ go", 'Say "not yet"', 'Start "fresh" & clean', ' min `back` ${then}']))
  })

  it('keeps the space a string starts or ends with', () => {
    const src = "const a = n + ' boards and '\n"
    const seg = scanJs('x.js', src).segments[0]
    expect(seg.nodes[0].v).toBe('boards and')
    expect(applyEdits('x.js', src, [{ id: seg.id, nodes: [text('  planks plus  ')] }])).toBe("const a = n + ' planks plus '\n")
  })

  it('refuses a change that would alter the code', () => {
    const seg = find(segments, 'Clear')
    // A marker the sentence never had cannot be smuggled in
    expect(() => applyEdits('src/App.jsx', code, [{ id: seg.id, nodes: [{ t: 'tok', k: 9 }] }])).toThrow()
  })
})

describe('telling wording from code', () => {
  it('accepts sentences, labels and messages', () => {
    for (const s of ['Could not save prices on this device.', 'top boards and bearers', 'Price = materials + labour.', '\u0001 saved', 'No customer']) {
      expect(looksLikeCopy(s, 'code'), s).toBe(true)
    }
    expect(looksLikeCopy('Draft', 'code')).toBe(true)
    expect(looksLikeCopy('bearers', 'copy-attr')).toBe(true)
  })
  it('rejects selectors, classes, paths, styles and formats', () => {
    for (const s of ['.nav a', 'quote-item current', 'en-AU', 'Pacific/Auckland', 'translate(4 2)', '600 12px Outfit', 'M 0 0 L 10 10',
      "'Outfit Variable', Arial, sans-serif", 'palletBusiness', './sample-quote.pdf', '\u0001-board-\u0001', 'draft', 'a=b&c=d', 'https://palletquoter.com/app']) {
      expect(looksLikeCopy(s, 'code'), s).toBe(false)
    }
  })
  it('reads text between tags the way the app does', () => {
    expect(cleanJsxText('\n      Delete   this\n      now \n    ')).toBe('Delete   this now')
    expect(cleanJsxText(' ex GST ')).toBe(' ex GST ')
  })
})

describe('install details', () => {
  it('edits the app name in the manifest', () => {
    const src = '{\n  "name": "Pallet Quoter",\n  "short_name": "Pallet Calc",\n  "display": "standalone"\n}'
    const segments = scanManifest('public/manifest.json', src)
    expect(segments.map(s => plainOf(s.nodes))).toEqual(['Pallet Quoter', 'Pallet Calc'])
    const next = applyEdits('public/manifest.json', src, [{ id: segments[1].id, nodes: [text('PQ "app"')] }])
    expect(JSON.parse(next).short_name).toBe('PQ "app"')
  })
})
