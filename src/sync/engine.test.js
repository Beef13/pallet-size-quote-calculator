import { describe, it, expect } from 'vitest'
import { createSyncEngine, DOCUMENT_KEYS, QUOTES_KEY, BACKUP_KEY } from './engine'

// A device: a little key/value store standing in for the browser's storage
function device() {
  const map = new Map()
  return {
    get: (k) => (map.has(k) ? map.get(k) : null),
    set: (k, v) => { map.set(k, v); return true },
    remove: (k) => map.delete(k),
    json: (k) => (map.has(k) ? JSON.parse(map.get(k)) : null),
    put: (k, v) => map.set(k, JSON.stringify(v))
  }
}

// The online side: one business per person, and the same "newest wins" rule as the database
function cloud() {
  const businesses = new Map() // userId -> { docs: Map, quotes: Map }
  const forUser = (userId) => ({
    ensureBusiness: async () => { if (!businesses.has(userId)) businesses.set(userId, { docs: new Map(), quotes: new Map() }); return `biz-${userId}` },
    fetchDocuments: async () => [...businesses.get(userId).docs.values()],
    fetchQuotes: async () => [...businesses.get(userId).quotes.values()],
    upsertDocuments: async (_b, rows) => { for (const r of rows) keepNewest(businesses.get(userId).docs, r.kind, r) },
    upsertQuotes: async (_b, rows) => { for (const r of rows) keepNewest(businesses.get(userId).quotes, r.id, r) }
  })
  const keepNewest = (table, key, row) => {
    const old = table.get(key)
    if (old && Date.parse(row.updated_at) < Date.parse(old.updated_at)) return
    table.set(key, JSON.parse(JSON.stringify(row)))
  }
  return { forUser, businesses }
}

// A clock that moves forward a minute each time it is read
function clock() {
  let n = 0
  return () => new Date(Date.UTC(2026, 9, 1, 0, n++)).toISOString()
}

const quote = (id, number, createdAt, extra = {}) => ({ id, number, createdAt, updatedAt: createdAt, status: 'draft', customerName: 'Acme', ...extra })

function setup() {
  const now = clock()
  const online = cloud()
  const make = (userId = 'alice') => {
    const storage = device()
    const engine = createSyncEngine({ storage, remote: online.forUser(userId), now })
    return { storage, engine, sync: () => engine.sync(userId) }
  }
  return { now, online, make }
}

describe('sync engine', () => {
  it('uploads a device\'s existing data on first sign-in, and a second device receives it', async () => {
    const { now, make } = setup()
    const a = make(), b = make()
    a.storage.put(DOCUMENT_KEYS.prices, { markup: 25 })
    a.storage.put(DOCUMENT_KEYS.business, { name: 'VPS Pallets' })
    a.storage.put(QUOTES_KEY, [quote('1', 'Q2026-0001', now())])

    const first = await a.sync()
    expect(first.pushed).toBe(3)
    expect(first.applied).toEqual([])

    const second = await b.sync()
    expect(second.applied.sort()).toEqual(['business', 'prices', 'quotes'])
    expect(b.storage.json(DOCUMENT_KEYS.prices)).toEqual({ markup: 25 })
    expect(b.storage.json(QUOTES_KEY)).toEqual(a.storage.json(QUOTES_KEY))
    expect(b.storage.get(BACKUP_KEY)).toBeNull() // nothing was replaced, so nothing to set aside
  })

  it('carries an edit from one device to the other', async () => {
    const { make } = setup()
    const a = make(), b = make()
    a.storage.put(DOCUMENT_KEYS.prices, { markup: 25 })
    await a.sync(); await b.sync()

    b.storage.put(DOCUMENT_KEYS.prices, { markup: 30 })
    b.engine.noteLocalChange(DOCUMENT_KEYS.prices)
    expect((await b.sync()).pushed).toBe(1)

    expect((await a.sync()).applied).toEqual(['prices'])
    expect(a.storage.json(DOCUMENT_KEYS.prices)).toEqual({ markup: 30 })
  })

  it('when both devices changed the same thing, the later change wins on both', async () => {
    const { make } = setup()
    const a = make(), b = make()
    a.storage.put(DOCUMENT_KEYS.prices, { markup: 25 })
    await a.sync(); await b.sync()

    a.storage.put(DOCUMENT_KEYS.prices, { markup: 10 }); a.engine.noteLocalChange(DOCUMENT_KEYS.prices)
    b.storage.put(DOCUMENT_KEYS.prices, { markup: 40 }); b.engine.noteLocalChange(DOCUMENT_KEYS.prices) // later
    await a.sync(); await b.sync(); await a.sync()

    expect(a.storage.json(DOCUMENT_KEYS.prices)).toEqual({ markup: 40 })
    expect(b.storage.json(DOCUMENT_KEYS.prices)).toEqual({ markup: 40 })
  })

  it('a quote deleted on one device disappears from the other', async () => {
    const { now, make } = setup()
    const a = make(), b = make()
    a.storage.put(QUOTES_KEY, [quote('1', 'Q2026-0001', now()), quote('2', 'Q2026-0002', now())])
    await a.sync(); await b.sync()

    a.storage.put(QUOTES_KEY, a.storage.json(QUOTES_KEY).filter(q => q.id !== '1'))
    a.engine.noteQuoteDeleted('1')
    await a.sync()
    expect(a.engine.readMeta().deleted).toEqual({})

    await b.sync()
    expect(b.storage.json(QUOTES_KEY).map(q => q.id)).toEqual(['2'])
    // and it stays gone
    await a.sync(); await b.sync()
    expect(a.storage.json(QUOTES_KEY).map(q => q.id)).toEqual(['2'])
  })

  it('two devices that gave out the same quote number offline end up with unique numbers', async () => {
    const { now, make } = setup()
    const a = make(), b = make()
    await a.sync(); await b.sync()
    a.storage.put(QUOTES_KEY, [quote('a1', 'Q2026-0001', now(), { customerName: 'First' })])
    b.storage.put(QUOTES_KEY, [quote('b1', 'Q2026-0001', now(), { customerName: 'Second' })])

    await a.sync()
    const r = await b.sync()
    expect(r.renumbered).toEqual([{ id: 'b1', from: 'Q2026-0001', to: 'Q2026-0002' }])
    await a.sync()

    const numbers = (d) => Object.fromEntries(d.storage.json(QUOTES_KEY).map(q => [q.customerName, q.number]))
    expect(numbers(a)).toEqual({ First: 'Q2026-0001', Second: 'Q2026-0002' })
    expect(numbers(b)).toEqual(numbers(a))
  })

  it('does not leak one account\'s data into another on a shared device', async () => {
    const { now, online, make } = setup()
    const shared = device()
    const asAlice = createSyncEngine({ storage: shared, remote: online.forUser('alice'), now })
    const asBob = createSyncEngine({ storage: shared, remote: online.forUser('bob'), now })
    shared.put(DOCUMENT_KEYS.prices, { markup: 25 })
    shared.put(QUOTES_KEY, [quote('1', 'Q2026-0001', now())])
    await asAlice.sync('alice')

    const r = await asBob.sync('bob')
    expect(r.replacedDevice).toBe(true)
    expect(online.businesses.get('bob').quotes.size).toBe(0)
    expect(online.businesses.get('bob').docs.size).toBe(0)
    expect(shared.get(QUOTES_KEY)).toBeNull()
    // Alice's data is untouched online, and what was on the device was set aside, not destroyed
    expect(online.businesses.get('alice').quotes.size).toBe(1)
    expect(JSON.parse(shared.get(BACKUP_KEY))[QUOTES_KEY]).toContain('Q2026-0001')
  })

  it('sets the device\'s own data aside before an account\'s data replaces it on first sign-in', async () => {
    const { make } = setup()
    const a = make(), b = make()
    a.storage.put(DOCUMENT_KEYS.business, { name: 'From the account' })
    await a.sync()

    b.storage.put(DOCUMENT_KEYS.business, { name: 'Typed on this device before signing in' })
    await b.sync()
    expect(b.storage.json(DOCUMENT_KEYS.business)).toEqual({ name: 'From the account' })
    expect(JSON.parse(b.storage.get(BACKUP_KEY))[DOCUMENT_KEYS.business]).toContain('Typed on this device')
  })

  it('devices converge: after everyone has synced, a further sync changes nothing', async () => {
    const { now, make } = setup()
    const a = make(), b = make()
    a.storage.put(DOCUMENT_KEYS.presets, [{ id: 'p1', name: 'Export' }])
    a.storage.put(QUOTES_KEY, [quote('1', 'Q2026-0001', now())])
    b.storage.put(QUOTES_KEY, [quote('2', 'Q2026-0002', now())])
    await a.sync(); await b.sync(); await a.sync()

    for (const d of [a, b]) {
      const r = await d.sync()
      expect(r).toMatchObject({ applied: [], pushed: 0, renumbered: [] })
    }
    expect(a.storage.json(QUOTES_KEY)).toEqual(b.storage.json(QUOTES_KEY))
    expect(a.storage.json(DOCUMENT_KEYS.presets)).toEqual(b.storage.json(DOCUMENT_KEYS.presets))
  })

  it('a change made while a sync is running is not lost', async () => {
    const { now, online } = setup()
    const storage = device()
    const remote = online.forUser('alice')
    const slow = { ...remote, fetchDocuments: async (b) => {
      const rows = await remote.fetchDocuments(b)
      // the user saves new prices while the fetch is in flight
      storage.put(DOCUMENT_KEYS.prices, { markup: 99 }); engine.noteLocalChange(DOCUMENT_KEYS.prices)
      slow.fetchDocuments = remote.fetchDocuments
      return rows
    } }
    const engine = createSyncEngine({ storage, remote: slow, now })
    const other = device()
    const otherEngine = createSyncEngine({ storage: other, remote, now })
    other.put(DOCUMENT_KEYS.prices, { markup: 25 })
    await otherEngine.sync('alice')

    await engine.sync('alice')
    expect(storage.json(DOCUMENT_KEYS.prices)).toEqual({ markup: 99 })
    await engine.sync('alice'); await otherEngine.sync('alice')
    expect(other.json(DOCUMENT_KEYS.prices)).toEqual({ markup: 99 })
  })
})
