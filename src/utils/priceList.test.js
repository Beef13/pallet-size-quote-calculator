import { describe, it, expect } from 'vitest'
import defaults from '../data/timber-prices.json'
import { mergePrices, makeSize, addSize, removeSize, renameType, addType, removeType, resetList } from './priceList'

const pine = (prices) => prices.timberTypes.find(t => t.id === 'pine-green-case')

describe('mergePrices with the standard list', () => {
  it('gives the standard list when nothing is saved', () => {
    const p = mergePrices(defaults, null)
    expect(p.timberTypes.map(t => t.id)).toEqual(defaults.timberTypes.map(t => t.id))
    expect(p.listEdited).toBe(false)
    expect(p.pricing).toEqual({ labourPerPallet: 0, markupPercent: 0, markupType: 'percent', markupAmount: 0, gstRate: 10, showGst: true })
  })
  it('lays saved prices over the standard list', () => {
    const saved = { timberTypes: [{ id: 'pine-green-case', boardSizes: [{ id: '100x17', pricePerBoard: 0.8 }] }], nailPricePerNail: 0.02 }
    const p = mergePrices(defaults, saved)
    expect(pine(p).boardSizes.find(s => s.id === '100x17').pricePerBoard).toBe(0.8)
    expect(pine(p).boardSizes.find(s => s.id === '100x19').pricePerBoard).toBe(0.75)
    expect(p.nailPricePerNail).toBe(0.02)
  })
  it('an old or partial file can never remove a timber type or size', () => {
    const p = mergePrices(defaults, { timberTypes: [] })
    expect(p.timberTypes.length).toBe(defaults.timberTypes.length)
    expect(pine(p).boardSizes.length).toBe(pine(defaults).boardSizes.length)
  })
  it('does not change the bundled defaults', () => {
    const before = JSON.stringify(defaults)
    mergePrices(defaults, { timberTypes: [{ id: 'pine-green-case', boardSizes: [{ id: '100x17', pricePerBoard: 9 }] }] })
    expect(JSON.stringify(defaults)).toBe(before)
  })
})

describe('mergePrices with an edited list', () => {
  it('keeps an edited list exactly, including removals and additions', () => {
    let p = mergePrices(defaults, null)
    p = removeType(p, 'kiln-dried')
    p = addSize(p, 'pine-green-case', 'board', 90, 22)
    p = addType(p, 'hardwood', 'Hardwood')
    const again = mergePrices(defaults, JSON.parse(JSON.stringify(p)))
    expect(again.listEdited).toBe(true)
    expect(again.timberTypes.map(t => t.id)).toEqual(['pine-green-case', 'hardwood'])
    expect(pine(again).boardSizes.some(s => s.id === '90x22')).toBe(true)
  })
  it('drops malformed entries from an imported file', () => {
    const p = mergePrices(defaults, {
      listEdited: true,
      timberTypes: [
        { id: 'a', name: '  ', boardSizes: [{ width: 100, thickness: 19, pricePerBoard: '0.7' }, { width: 0, thickness: 19 }, { width: 100, thickness: 19 }], bearerSizes: 'nope' },
        { name: 'no id' },
        { id: 'a', name: 'duplicate' }
      ]
    })
    expect(p.timberTypes).toEqual([
      { id: 'a', name: 'Timber', boardSizes: [{ id: '100x19', dimensions: '100x19mm', width: 100, thickness: 19, pricePerBoard: 0.7 }], bearerSizes: [] }
    ])
  })
})

describe('editing the list', () => {
  const base = mergePrices(defaults, null)
  it('adds a size in order, priced at $0 until set', () => {
    const p = addSize(base, 'pine-green-case', 'board', 100, 15)
    const ids = pine(p).boardSizes.map(s => s.id)
    expect(ids.indexOf('100x15')).toBe(ids.indexOf('100x12') + 1)
    expect(pine(p).boardSizes.find(s => s.id === '100x15').pricePerBoard).toBe(0)
    expect(p.listEdited).toBe(true)
  })
  it('ignores a duplicate or an invalid size', () => {
    expect(addSize(base, 'pine-green-case', 'board', 100, 19)).toBe(base)
    expect(addSize(base, 'pine-green-case', 'board', '', 19)).toBe(base)
    expect(addSize(base, 'pine-green-case', 'board', -5, 19)).toBe(base)
    expect(makeSize(100, 0)).toBeNull()
  })
  it('adds bearer sizes with a bearer price', () => {
    const p = addSize(base, 'pine-green-case', 'bearer', 75, 38)
    expect(pine(p).bearerSizes.find(s => s.id === '75x38')).toEqual({ id: '75x38', dimensions: '75x38mm', width: 75, thickness: 38, pricePerBearer: 0 })
  })
  it('removes a size and a whole timber type', () => {
    expect(pine(removeSize(base, 'pine-green-case', 'board', '100x19')).boardSizes.some(s => s.id === '100x19')).toBe(false)
    expect(removeType(base, 'kiln-dried').timberTypes.map(t => t.id)).toEqual(['pine-green-case'])
  })
  it('renames a timber type and drops its old short label', () => {
    const kd = renameType(base, 'kiln-dried', 'KD Pine').timberTypes.find(t => t.id === 'kiln-dried')
    expect(kd.name).toBe('KD Pine')
    expect(kd.shortName).toBeUndefined()
  })
  it('reset goes back to the standard list but keeps nail price and pricing settings', () => {
    let p = removeType(base, 'kiln-dried')
    p = { ...p, nailPricePerNail: 0.03, pricing: { ...p.pricing, markupPercent: 25 } }
    const r = resetList(defaults, p)
    expect(r.timberTypes.length).toBe(defaults.timberTypes.length)
    expect(r.listEdited).toBe(false)
    expect(r.nailPricePerNail).toBe(0.03)
    expect(r.pricing.markupPercent).toBe(25)
  })
  it('never mutates the list it was given', () => {
    const before = JSON.stringify(base)
    addSize(base, 'pine-green-case', 'board', 90, 22); removeSize(base, 'pine-green-case', 'board', '100x19')
    renameType(base, 'kiln-dried', 'X'); addType(base, 'n', 'N'); removeType(base, 'kiln-dried')
    expect(JSON.stringify(base)).toBe(before)
  })
})
