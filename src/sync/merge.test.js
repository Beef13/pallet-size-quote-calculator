import { describe, it, expect } from 'vitest'
import { mergeDocument, mergeQuotes, fixDuplicateNumbers } from './merge'

const t = (n) => new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString() // minute n
const quote = (id, minute, extra = {}) => ({ id, number: `Q2026-000${id}`, createdAt: t(0), updatedAt: t(minute), status: 'draft', ...extra })
const row = (id, minute, extra = {}) => ({ id: String(id), data: quote(id, minute, extra), updated_at: t(minute), deleted_at: null })

describe('mergeDocument', () => {
  it('sends local data up when nothing is stored online', () => {
    expect(mergeDocument({ data: { a: 1 }, updatedAt: t(5) }, null)).toEqual({ action: 'push', data: { a: 1 }, updatedAt: t(5) })
    expect(mergeDocument({ data: { a: 1 }, updatedAt: null }, null, t(9))).toEqual({ action: 'push', data: { a: 1 }, updatedAt: t(9) })
  })
  it('does nothing when neither side has anything', () => {
    expect(mergeDocument(null, null).action).toBe('none')
    expect(mergeDocument({ data: null, updatedAt: null }, null).action).toBe('none')
  })
  it('brings the online copy down to a device that has none, or has never changed its own', () => {
    const remote = { data: { a: 2 }, updated_at: t(3) }
    expect(mergeDocument(null, remote)).toEqual({ action: 'pull', data: { a: 2 }, updatedAt: t(3) })
    expect(mergeDocument({ data: { a: 1 }, updatedAt: null }, remote).action).toBe('pull')
  })
  it('newest change wins in both directions, and equal times do nothing', () => {
    const remote = { data: { a: 2 }, updated_at: t(5) }
    expect(mergeDocument({ data: { a: 1 }, updatedAt: t(6) }, remote).action).toBe('push')
    expect(mergeDocument({ data: { a: 1 }, updatedAt: t(4) }, remote).action).toBe('pull')
    expect(mergeDocument({ data: { a: 1 }, updatedAt: t(5) }, remote).action).toBe('none')
  })
})

describe('mergeQuotes', () => {
  it('sends new local quotes up and brings new online quotes down', () => {
    const r = mergeQuotes([quote(1, 1)], {}, [row(2, 2)])
    expect(r.quotes.map(q => q.id).sort()).toEqual([1, 2])
    expect(r.push.map(p => p.id)).toEqual(['1'])
    expect(r.changed).toBe(true)
  })
  it('is a no-op when both sides already match', () => {
    const r = mergeQuotes([quote(1, 1)], {}, [row(1, 1)])
    expect(r.push).toEqual([])
    expect(r.changed).toBe(false)
  })
  it('keeps the newer version of a quote changed on both sides', () => {
    const mineNewer = mergeQuotes([quote(1, 9, { status: 'sent' })], {}, [row(1, 2)])
    expect(mineNewer.push[0].data.status).toBe('sent')
    expect(mineNewer.changed).toBe(false)
    const theirsNewer = mergeQuotes([quote(1, 2)], {}, [row(1, 9, { status: 'accepted' })])
    expect(theirsNewer.quotes[0].status).toBe('accepted')
    expect(theirsNewer.push).toEqual([])
  })
  it('a quote deleted here is deleted online', () => {
    const r = mergeQuotes([], { 1: t(5) }, [row(1, 2)])
    expect(r.push).toEqual([{ id: '1', data: null, updated_at: t(5), deleted_at: t(5) }])
    expect(r.quotes).toEqual([])
    expect(r.tombstones).toEqual({})
  })
  it('a quote deleted on another device is removed here', () => {
    const r = mergeQuotes([quote(1, 2)], {}, [{ id: '1', data: null, updated_at: t(5), deleted_at: t(5) }])
    expect(r.quotes).toEqual([])
    expect(r.push).toEqual([])
  })
  it('an edit made after a delete brings the quote back, whichever side made it', () => {
    const editedElsewhere = mergeQuotes([], { 1: t(3) }, [row(1, 8, { status: 'accepted' })])
    expect(editedElsewhere.quotes[0].status).toBe('accepted')
    expect(editedElsewhere.push).toEqual([])
    const editedHere = mergeQuotes([quote(1, 8, { status: 'sent' })], {}, [{ id: '1', data: null, updated_at: t(3), deleted_at: t(3) }])
    expect(editedHere.quotes.length).toBe(1)
    expect(editedHere.push[0]).toMatchObject({ id: '1', deleted_at: null })
  })
  it('never drops a quote that exists on only one side', () => {
    const local = [quote(1, 1), quote(2, 1), quote(3, 1)]
    const remote = [row(3, 1), row(4, 1), row(5, 1)]
    const r = mergeQuotes(local, {}, remote)
    expect(r.quotes.map(q => q.id).sort()).toEqual([1, 2, 3, 4, 5])
  })
  it('lists the newest quotes first', () => {
    const r = mergeQuotes([quote(1, 1, { createdAt: t(1) })], {}, [row(2, 1, { createdAt: t(7) }), row(3, 1, { createdAt: t(4) })])
    expect(r.quotes.map(q => q.id)).toEqual([2, 3, 1])
  })
})

describe('fixDuplicateNumbers', () => {
  it('leaves unique numbers alone', () => {
    const quotes = [quote(1, 1), quote(2, 1)]
    expect(fixDuplicateNumbers(quotes)).toEqual({ quotes, renumbered: [] })
  })
  it('keeps the number on the older quote and gives the newer one the next free number', () => {
    const a = { id: 'a', number: 'Q2026-0004', createdAt: t(1), updatedAt: t(1) }
    const b = { id: 'b', number: 'Q2026-0004', createdAt: t(2), updatedAt: t(2) }
    const c = { id: 'c', number: 'Q2026-0005', createdAt: t(3), updatedAt: t(3) }
    const r = fixDuplicateNumbers([c, b, a], t(30))
    expect(r.renumbered).toEqual([{ id: 'b', from: 'Q2026-0004', to: 'Q2026-0006' }])
    expect(r.quotes.find(q => q.id === 'b')).toMatchObject({ number: 'Q2026-0006', updatedAt: t(30) })
    expect(r.quotes.find(q => q.id === 'a').number).toBe('Q2026-0004')
    expect(new Set(r.quotes.map(q => q.number)).size).toBe(3)
  })
  it('handles three quotes with the same number', () => {
    const qs = ['a', 'b', 'c'].map((id, i) => ({ id, number: 'Q2026-0001', createdAt: t(i), updatedAt: t(i) }))
    const r = fixDuplicateNumbers(qs, t(30))
    expect(r.quotes.map(q => q.number).sort()).toEqual(['Q2026-0001', 'Q2026-0002', 'Q2026-0003'])
  })
})
