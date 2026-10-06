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

// ---------- History tab: quotes grouped by what needs doing next ----------

const sentTime = (quote) => Date.parse(quote.sentAt || quote.updatedAt || quote.createdAt || '')
const changedTime = (quote) => {
  const t = Date.parse(quote.updatedAt || quote.createdAt || '')
  return Number.isFinite(t) ? t : 0
}

/**
 * One line about a sent quote for its History row: how long ago it went out and,
 * while it is still valid, how long it has left. Empty for anything that isn't sent.
 */
export function sentSummary(quote, now = Date.now(), validDays = 30) {
  if (!quote || quote.status !== 'sent') return ''
  const sent = sentTime(quote)
  if (!Number.isFinite(sent)) return ''
  const days = Math.max(0, Math.floor((now - sent) / DAY))
  const sentText = days === 0 ? 'Sent today' : `Sent ${days} day${days === 1 ? '' : 's'} ago`
  const storedUntil = Date.parse(quote.validUntil || '')
  const validUntil = Number.isFinite(storedUntil) ? storedUntil : sent + Math.max(1, Number(validDays) || 30) * DAY
  if (now > validUntil) return `${sentText} · no longer valid`
  const left = Math.ceil((validUntil - now) / DAY)
  return `${sentText} · valid ${left} more day${left === 1 ? '' : 's'}`
}

/**
 * Splits saved quotes into the four History sections, in the order they are shown:
 *   chase   - sent, and flagged by quoteAttention (follow-ups first, then expired)
 *   drafts  - not sent yet (anything with an unknown status lands here so it is never hidden)
 *   waiting - sent and still inside its valid period
 *   decided - accepted or lost, most recently changed first
 * Within chase, drafts and waiting the incoming order is kept.
 */
export function groupQuotes(quotes, now = Date.now(), validDays = 30) {
  const groups = { chase: [], drafts: [], waiting: [], decided: [] }
  const expired = []
  for (const q of quotes || []) {
    if (!q) continue
    if (q.status === 'accepted' || q.status === 'lost') groups.decided.push(q)
    else if (q.status === 'sent') {
      const attention = quoteAttention(q, now, validDays)
      if (!attention) groups.waiting.push(q)
      else if (attention.kind === 'expired') expired.push(q)
      else groups.chase.push(q)
    } else groups.drafts.push(q)
  }
  groups.chase.push(...expired)
  groups.decided.sort((a, b) => changedTime(b) - changedTime(a))
  return groups
}

/** Decided quotes split by the month they were last changed, newest month first. */
export function quotesByMonth(quotes) {
  const months = []
  const sorted = [...(quotes || [])].sort((a, b) => changedTime(b) - changedTime(a))
  for (const q of sorted) {
    const d = new Date(changedTime(q))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let month = months[months.length - 1]
    if (!month || month.key !== key) {
      month = { key, label: d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }), quotes: [] }
      months.push(month)
    }
    month.quotes.push(q)
  }
  return months
}

/** Total value (ex GST) of a set of saved quotes. */
export function quotesTotal(quotes) {
  return (quotes || []).reduce((sum, q) => sum + (Number(q?.summary?.totalExGst) || 0), 0)
}
