// The rules for combining what's on this device with what's stored online.
// Pure functions: no network, no storage. The rule throughout is "the newest change wins",
// and nothing is deleted on one side unless the other side really did delete it later.

const time = (iso) => {
  const t = Date.parse(iso || '')
  return Number.isFinite(t) ? t : 0
}

/**
 * One document (the price list, the presets, or the business details).
 * @param {{data: any, updatedAt: string|null}|null} local  - null when this device has nothing
 * @param {{data: any, updated_at: string}|null} remote     - null when nothing is stored online
 * @returns {{action: 'push'|'pull'|'none', data?: any, updatedAt?: string}}
 */
export function mergeDocument(local, remote, now = new Date().toISOString()) {
  const hasLocal = local && local.data != null
  if (!remote) {
    return hasLocal ? { action: 'push', data: local.data, updatedAt: local.updatedAt || now } : { action: 'none' }
  }
  if (!hasLocal) return { action: 'pull', data: remote.data, updatedAt: remote.updated_at }
  // No local timestamp means this device has never changed the document since it was last
  // in step, so the online copy is the one to keep.
  if (!local.updatedAt) return { action: 'pull', data: remote.data, updatedAt: remote.updated_at }
  const l = time(local.updatedAt), r = time(remote.updated_at)
  if (l > r) return { action: 'push', data: local.data, updatedAt: local.updatedAt }
  if (r > l) return { action: 'pull', data: remote.data, updatedAt: remote.updated_at }
  return { action: 'none' }
}

const quoteTime = (q) => time(q.updatedAt || q.createdAt)

/**
 * Saved quotes, one by one.
 * @param {Array<object>} localQuotes   - quotes on this device
 * @param {Record<string,string>} tombstones - id -> time, for quotes deleted on this device
 * @param {Array<{id: string, data: object|null, updated_at: string, deleted_at: string|null}>} remoteRows
 * @returns {{quotes: object[], push: object[], tombstones: Record<string,string>, changed: boolean}}
 *   `push` holds rows to send: {id, data, updated_at, deleted_at}
 */
export function mergeQuotes(localQuotes, tombstones, remoteRows) {
  const local = new Map(localQuotes.map(q => [String(q.id), q]))
  const remote = new Map(remoteRows.map(r => [String(r.id), r]))
  const result = new Map(local)
  const push = []
  const left = {} // tombstones still waiting (none after a successful sync)
  let changed = false

  const sendLive = (q) => push.push({ id: String(q.id), data: q, updated_at: new Date(quoteTime(q) || Date.now()).toISOString(), deleted_at: null })
  const sendDeleted = (id, at) => push.push({ id, data: null, updated_at: at, deleted_at: at })

  for (const [id, row] of remote) {
    const mine = local.get(id)
    const deletedHere = tombstones[id]

    if (row.deleted_at) {
      // Deleted on another device. Keep ours only if we changed it after that.
      if (mine && quoteTime(mine) > time(row.deleted_at)) sendLive(mine)
      else if (mine) { result.delete(id); changed = true }
      continue
    }

    if (deletedHere) {
      // Deleted here. If someone edited it elsewhere after that, the edit wins and it comes back.
      if (time(deletedHere) >= time(row.updated_at)) sendDeleted(id, deletedHere)
      else { result.set(id, row.data); changed = true }
      continue
    }

    if (!mine) { result.set(id, row.data); changed = true; continue }
    const l = quoteTime(mine), r = time(row.updated_at)
    if (l > r) sendLive(mine)
    else if (r > l) { result.set(id, row.data); changed = true }
  }

  // Quotes that only exist here are new: send them up
  for (const [id, mine] of local) {
    if (!remote.has(id)) sendLive(mine)
  }
  // A tombstone for a quote that was never stored online has nothing left to do

  const quotes = [...result.values()].sort((a, b) => time(b.createdAt || b.updatedAt) - time(a.createdAt || a.updatedAt))
  return { quotes, push, tombstones: left, changed }
}

const NUMBER = /^Q(\d{4})-(\d+)$/

/**
 * Two devices that were both offline can hand out the same quote number. Keep the number on
 * the quote that was created first and give the later one the next free number for its year.
 * @returns {{quotes: object[], renumbered: Array<{id: string, from: string, to: string}>}}
 */
export function fixDuplicateNumbers(quotes, now = new Date().toISOString()) {
  const highest = {}
  for (const q of quotes) {
    const m = NUMBER.exec(q.number || '')
    if (m) highest[m[1]] = Math.max(highest[m[1]] || 0, parseInt(m[2], 10))
  }
  const seen = new Map()
  const renumbered = []
  const byAge = [...quotes].sort((a, b) => time(a.createdAt) - time(b.createdAt) || String(a.id).localeCompare(String(b.id)))
  const replacement = new Map()
  for (const q of byAge) {
    if (!q.number) continue
    if (!seen.has(q.number)) { seen.set(q.number, q.id); continue }
    const m = NUMBER.exec(q.number)
    const year = m ? m[1] : String(new Date(now).getFullYear())
    highest[year] = (highest[year] || 0) + 1
    const to = `Q${year}-${String(highest[year]).padStart(4, '0')}`
    seen.set(to, q.id)
    replacement.set(q.id, { ...q, number: to, updatedAt: now })
    renumbered.push({ id: String(q.id), from: q.number, to })
  }
  return { quotes: quotes.map(q => replacement.get(q.id) || q), renumbered }
}
