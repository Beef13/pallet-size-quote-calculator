// Which saved quotes need chasing.
// A quote that has been sent but not answered is flagged once it is a week old ("Follow up"),
// and once its validity period has run out ("Expired"). Drafts and answered quotes are never flagged.

const DAY = 86400000
export const FOLLOW_UP_DAYS = 7

/**
 * @param {{status: string, sentAt?: string, updatedAt?: string, createdAt?: string, validUntil?: string}} quote
 * @param {number} now - time in ms
 * @param {number} validDays - used when the quote has no stored validUntil
 * @returns {null | {kind: 'follow-up' | 'expired', label: string, detail: string}}
 */
export function quoteAttention(quote, now = Date.now(), validDays = 30) {
  if (!quote || quote.status !== 'sent') return null
  const sent = Date.parse(quote.sentAt || quote.updatedAt || quote.createdAt || '')
  if (!Number.isFinite(sent)) return null
  const days = Math.floor((now - sent) / DAY)
  const sentText = days <= 0 ? 'Sent today' : `Sent ${days} day${days === 1 ? '' : 's'} ago`
  const storedUntil = Date.parse(quote.validUntil || '')
  const validUntil = Number.isFinite(storedUntil) ? storedUntil : sent + Math.max(1, Number(validDays) || 30) * DAY
  if (now > validUntil) return { kind: 'expired', label: 'Expired', detail: `${sentText}, no longer valid` }
  if (days >= FOLLOW_UP_DAYS) return { kind: 'follow-up', label: 'Follow up', detail: `${sentText}, no answer yet` }
  return null
}
