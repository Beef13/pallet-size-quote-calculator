import { describe, it, expect } from 'vitest'
import { quoteAttention, sentSummary, groupQuotes, quotesByMonth, quotesTotal } from './quotes'

const DAY = 86400000
const now = Date.parse('2026-10-20T02:00:00Z')
const daysAgo = (n) => new Date(now - n * DAY).toISOString()

describe('quoteAttention', () => {
  it('never flags drafts, accepted or lost quotes', () => {
    for (const status of ['draft', 'accepted', 'lost']) {
      expect(quoteAttention({ status, sentAt: daysAgo(90) }, now)).toBeNull()
    }
  })
  it('leaves a recently sent quote alone', () => {
    expect(quoteAttention({ status: 'sent', sentAt: daysAgo(0) }, now)).toBeNull()
    expect(quoteAttention({ status: 'sent', sentAt: daysAgo(6) }, now)).toBeNull()
  })
  it('asks for a follow-up after a week with no answer', () => {
    expect(quoteAttention({ status: 'sent', sentAt: daysAgo(7) }, now)).toEqual({ kind: 'follow-up', label: 'Follow up', detail: 'Sent 7 days ago, no answer yet' })
    expect(quoteAttention({ status: 'sent', sentAt: daysAgo(29) }, now).kind).toBe('follow-up')
  })
  it('marks it expired once the validity period has passed', () => {
    expect(quoteAttention({ status: 'sent', sentAt: daysAgo(31) }, now, 30)).toEqual({ kind: 'expired', label: 'Expired', detail: 'Sent 31 days ago, no longer valid' })
    expect(quoteAttention({ status: 'sent', sentAt: daysAgo(15) }, now, 14).kind).toBe('expired')
  })
  it('uses the valid-until date stored on the quote over the current setting', () => {
    const q = { status: 'sent', sentAt: daysAgo(10), validUntil: daysAgo(1) }
    expect(quoteAttention(q, now, 30).kind).toBe('expired')
    expect(quoteAttention({ ...q, validUntil: new Date(now + 5 * DAY).toISOString() }, now, 3).kind).toBe('follow-up')
  })
  it('falls back to the last update for quotes marked sent by hand', () => {
    expect(quoteAttention({ status: 'sent', updatedAt: daysAgo(8) }, now).kind).toBe('follow-up')
    expect(quoteAttention({ status: 'sent' }, now)).toBeNull()
  })
})

describe('sentSummary', () => {
  it('says how long ago a quote was sent and how long it stays valid', () => {
    expect(sentSummary({ status: 'sent', sentAt: daysAgo(2) }, now, 30)).toBe('Sent 2 days ago · valid 28 more days')
    expect(sentSummary({ status: 'sent', sentAt: daysAgo(0) }, now, 30)).toBe('Sent today · valid 30 more days')
    expect(sentSummary({ status: 'sent', sentAt: daysAgo(1), validUntil: new Date(now + DAY).toISOString() }, now)).toBe('Sent 1 day ago · valid 1 more day')
  })
  it('says when the quote is no longer valid', () => {
    expect(sentSummary({ status: 'sent', sentAt: daysAgo(34) }, now, 30)).toBe('Sent 34 days ago · no longer valid')
  })
  it('is empty for quotes that are not sent', () => {
    expect(sentSummary({ status: 'draft', createdAt: daysAgo(3) }, now)).toBe('')
    expect(sentSummary(null, now)).toBe('')
  })
})

describe('groupQuotes', () => {
  const quotes = [
    { id: 'a', status: 'sent', sentAt: daysAgo(2) },
    { id: 'b', status: 'sent', sentAt: daysAgo(40) },
    { id: 'c', status: 'draft', updatedAt: daysAgo(1) },
    { id: 'd', status: 'sent', sentAt: daysAgo(9) },
    { id: 'e', status: 'accepted', updatedAt: daysAgo(20) },
    { id: 'f', status: 'lost', updatedAt: daysAgo(3) },
    { id: 'g', updatedAt: daysAgo(1) }
  ]
  const ids = (list) => list.map(q => q.id)
  const groups = groupQuotes(quotes, now, 30)

  it('puts every quote in exactly one section', () => {
    const all = [...groups.chase, ...groups.drafts, ...groups.waiting, ...groups.decided]
    expect(ids(all).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })
  it('lists follow-ups before expired quotes in To chase', () => {
    expect(ids(groups.chase)).toEqual(['d', 'b'])
  })
  it('keeps recently sent quotes in Waiting', () => {
    expect(ids(groups.waiting)).toEqual(['a'])
  })
  it('treats drafts and unknown statuses as drafts', () => {
    expect(ids(groups.drafts)).toEqual(['c', 'g'])
  })
  it('lists decided quotes most recently changed first', () => {
    expect(ids(groups.decided)).toEqual(['f', 'e'])
  })
  it('copes with nothing saved', () => {
    expect(groupQuotes(undefined, now)).toEqual({ chase: [], drafts: [], waiting: [], decided: [] })
  })
})

describe('quotesByMonth and quotesTotal', () => {
  it('splits quotes by month, newest first', () => {
    const months = quotesByMonth([
      { id: 'old', updatedAt: '2026-08-15T02:00:00Z' },
      { id: 'new', updatedAt: '2026-10-10T02:00:00Z' },
      { id: 'mid', updatedAt: '2026-10-05T02:00:00Z' }
    ])
    expect(months.map(m => m.key)).toEqual(['2026-10', '2026-08'])
    expect(months[0].label).toBe('October 2026')
    expect(months[0].quotes.map(q => q.id)).toEqual(['new', 'mid'])
  })
  it('adds up totals and ignores missing ones', () => {
    expect(quotesTotal([{ summary: { totalExGst: 100.5 } }, {}, { summary: { totalExGst: 50 } }])).toBe(150.5)
    expect(quotesTotal([])).toBe(0)
  })
})
