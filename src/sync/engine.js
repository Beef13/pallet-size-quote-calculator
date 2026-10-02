// Keeps this device and the online copy in step. It only knows two things: a place to keep
// strings on the device (`storage`) and a `remote` that can fetch and save rows. Both are
// passed in, so the same code runs against the browser + Supabase and against fakes in tests.
import { mergeDocument, mergeQuotes, fixDuplicateNumbers } from './merge.js'

// What is synced, and where each piece lives on the device
export const DOCUMENT_KEYS = { prices: 'timberPrices', presets: 'palletPresets', business: 'palletBusiness' }
export const QUOTES_KEY = 'palletQuotes'
export const META_KEY = 'palletSyncMeta'
// A copy of what was on the device before it was first replaced by an account's data
export const BACKUP_KEY = 'palletPreSyncBackup'

const KIND_OF = Object.fromEntries(Object.entries(DOCUMENT_KEYS).map(([kind, key]) => [key, kind]))
const emptyMeta = () => ({ userId: null, businessId: null, docs: {}, deleted: {}, lastSyncedAt: null })

const parse = (text) => {
  if (text == null) return null
  try { return JSON.parse(text) } catch (e) { return null }
}

export function createSyncEngine({ storage, remote, now = () => new Date().toISOString() }) {
  const readMeta = () => ({ ...emptyMeta(), ...(parse(storage.get(META_KEY)) || {}) })
  const writeMeta = (meta) => storage.set(META_KEY, JSON.stringify(meta))

  /** The app changed one of the synced documents: remember when, so the newest change can win. */
  function noteLocalChange(storageKey) {
    const kind = KIND_OF[storageKey]
    if (!kind) return storageKey === QUOTES_KEY
    const meta = readMeta()
    meta.docs[kind] = now()
    writeMeta(meta)
    return true
  }

  /** A quote was deleted here: remember it so the deletion reaches the other devices. */
  function noteQuoteDeleted(id) {
    const meta = readMeta()
    meta.deleted[String(id)] = now()
    writeMeta(meta)
  }

  function stashBackup() {
    if (storage.get(BACKUP_KEY)) return // keep the oldest copy
    const copy = { savedAt: now() }
    for (const key of [...Object.values(DOCUMENT_KEYS), QUOTES_KEY]) copy[key] = storage.get(key)
    if (Object.values(DOCUMENT_KEYS).concat(QUOTES_KEY).some(key => copy[key] != null)) storage.set(BACKUP_KEY, JSON.stringify(copy))
  }

  /**
   * Bring the device and the account into step.
   * @returns {{applied: string[], pushed: number, renumbered: object[], replacedDevice: boolean}}
   *   `applied` lists what changed on this device: 'prices', 'presets', 'business', 'quotes'
   */
  async function sync(userId) {
    let meta = readMeta()
    const applied = new Set()
    let replacedDevice = false

    // This device was linked to a different account: its data belongs to that account and must
    // not leak into this one. Set it aside and start from what this account has.
    if (meta.userId && meta.userId !== userId) {
      stashBackup()
      for (const key of [...Object.values(DOCUMENT_KEYS), QUOTES_KEY]) storage.remove(key)
      meta = emptyMeta()
      writeMeta(meta)
      replacedDevice = true
      for (const kind of [...Object.keys(DOCUMENT_KEYS), 'quotes']) applied.add(kind)
    }
    const firstLink = !meta.userId

    const businessId = meta.businessId || await remote.ensureBusiness()
    const [remoteDocs, remoteQuotes] = await Promise.all([remote.fetchDocuments(businessId), remote.fetchQuotes(businessId)])

    // The app may have saved something while we were fetching. From here until the device's
    // copy is updated there are no more waits, so read the device's state fresh, now.
    const fresh = readMeta()
    meta.docs = fresh.docs
    meta.deleted = fresh.deleted
    const docsAtStart = { ...meta.docs }

    // --- Documents ---
    const pushDocs = []
    for (const [kind, key] of Object.entries(DOCUMENT_KEYS)) {
      const before = storage.get(key)
      const local = { data: parse(before), updatedAt: meta.docs[kind] || null }
      const row = remoteDocs.find(r => r.kind === kind) || null
      const result = mergeDocument(local, row, now())
      if (result.action === 'push') {
        pushDocs.push({ kind, data: result.data, updated_at: result.updatedAt })
        meta.docs[kind] = result.updatedAt
      } else if (result.action === 'pull') {
        const incoming = JSON.stringify(result.data)
        if (incoming !== before) {
          if (firstLink && before != null) stashBackup()
          storage.set(key, incoming)
          applied.add(kind)
        }
        meta.docs[kind] = result.updatedAt
      }
    }

    // --- Quotes ---
    const quotesBefore = storage.get(QUOTES_KEY)
    const localQuotes = parse(quotesBefore)
    const tombstonesAtStart = { ...meta.deleted }
    const merged = mergeQuotes(Array.isArray(localQuotes) ? localQuotes : [], tombstonesAtStart, remoteQuotes)
    const fixed = fixDuplicateNumbers(merged.quotes, now())
    const pushQuotes = merged.push.filter(p => !fixed.renumbered.some(r => r.id === p.id))
    for (const r of fixed.renumbered) {
      const q = fixed.quotes.find(x => String(x.id) === r.id)
      pushQuotes.push({ id: r.id, data: q, updated_at: q.updatedAt, deleted_at: null })
    }
    if (merged.changed || fixed.renumbered.length > 0) {
      storage.set(QUOTES_KEY, JSON.stringify(fixed.quotes))
      applied.add('quotes')
    }

    // --- Send our side up ---
    if (pushDocs.length) await remote.upsertDocuments(businessId, pushDocs)
    for (let i = 0; i < pushQuotes.length; i += 100) await remote.upsertQuotes(businessId, pushQuotes.slice(i, i + 100))

    // --- Remember where we got to. Re-read so changes noted while we were busy are kept. ---
    const latest = readMeta()
    for (const kind of Object.keys(DOCUMENT_KEYS)) {
      // only move a document's time forward to what we just settled if the app hasn't changed it since
      if ((latest.docs[kind] || null) === (docsAtStart[kind] || null)) latest.docs[kind] = meta.docs[kind] || latest.docs[kind]
    }
    for (const id of Object.keys(tombstonesAtStart)) {
      if (latest.deleted[id] === tombstonesAtStart[id]) delete latest.deleted[id]
    }
    latest.userId = userId
    latest.businessId = businessId
    latest.lastSyncedAt = now()
    writeMeta(latest)

    return { applied: [...applied], pushed: pushDocs.length + pushQuotes.length, renumbered: fixed.renumbered, replacedDevice }
  }

  let running = null
  let again = false

  /** Run a sync, never two at once. A request made while one is running triggers one more afterwards. */
  async function run(userId) {
    if (running) { again = true; return running }
    running = (async () => {
      let last
      do {
        again = false
        last = await sync(userId)
      } while (again)
      return last
    })()
    try { return await running } finally { running = null }
  }

  /** Forget the link to the account (used after the online data is deleted). Device data stays. */
  function unlink() {
    writeMeta(emptyMeta())
  }

  return { sync: run, noteLocalChange, noteQuoteDeleted, readMeta, unlink }
}
