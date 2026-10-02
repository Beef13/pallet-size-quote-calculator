import { describe, it, expect } from 'vitest'
import { quoteAttention } from './quotes'

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
