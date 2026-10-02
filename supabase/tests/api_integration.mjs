// End-to-end check of the online side through the same data API Supabase uses (PostgREST),
// with the real supabase-js client and the app's own sync engine.
// Run by supabase/tests/run_api_local.sh, which starts the database and API first.
import { createHmac } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseRemote } from '../../src/sync/supabaseRemote.js'
import { createSyncEngine, DOCUMENT_KEYS, QUOTES_KEY } from '../../src/sync/engine.js'

const API = process.env.API_URL
const SECRET = process.env.JWT_SECRET
const ALICE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const BOB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function token(sub) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 })}`
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
}
// supabase-js talks to <url>/rest/v1/...; the bare API server serves the same routes at /
const rewrite = (input, init) => fetch(String(input).replace('/rest/v1/', '/'), init)
const clientFor = (sub) => createClient(API, 'local-test-key', { accessToken: async () => (sub ? token(sub) : null), global: { fetch: rewrite } })

function device() {
  const map = new Map()
  return {
    get: (k) => (map.has(k) ? map.get(k) : null), set: (k, v) => { map.set(k, v); return true }, remove: (k) => map.delete(k),
    json: (k) => (map.has(k) ? JSON.parse(map.get(k)) : null), put: (k, v) => map.set(k, JSON.stringify(v))
  }
}
const quote = (id, number, extra = {}) => ({ id, number, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'draft', ...extra })
const step = async (name, fn) => { await fn(); console.log('ok  ', name) }

const alice = clientFor(ALICE), bob = clientFor(BOB)
const phone = device(), laptop = device()
const onPhone = createSyncEngine({ storage: phone, remote: createSupabaseRemote(alice) })
const onLaptop = createSyncEngine({ storage: laptop, remote: createSupabaseRemote(alice) })

await step('first sign-in uploads what is on the device', async () => {
  phone.put(DOCUMENT_KEYS.prices, { pricing: { markupPercent: 25 }, timberTypes: [] })
  phone.put(DOCUMENT_KEYS.business, { name: 'VPS Pallets', logo: 'data:image/png;base64,' + 'A'.repeat(20000) })
  phone.put(DOCUMENT_KEYS.presets, [{ id: 'p1', name: 'Export 1165' }])
  phone.put(QUOTES_KEY, [quote('q1', 'Q2026-0001', { customerName: 'Harbour Freight' }), quote('q2', 'Q2026-0002')])
  const r = await onPhone.sync(ALICE)
  assert.equal(r.pushed, 5)
})

await step('a second device signed in to the same account receives everything', async () => {
  const r = await onLaptop.sync(ALICE)
  assert.deepEqual(r.applied.sort(), ['business', 'presets', 'prices', 'quotes'])
  assert.deepEqual(laptop.json(DOCUMENT_KEYS.business), phone.json(DOCUMENT_KEYS.business))
  assert.deepEqual(laptop.json(QUOTES_KEY).map(q => q.id).sort(), ['q1', 'q2'])
})

await step('an edit and a deletion travel between devices', async () => {
  await new Promise(r => setTimeout(r, 20))
  laptop.put(QUOTES_KEY, laptop.json(QUOTES_KEY).filter(q => q.id !== 'q2').map(q => ({ ...q, status: 'sent', updatedAt: new Date().toISOString() })))
  onLaptop.noteQuoteDeleted('q2')
  await onLaptop.sync(ALICE)
  await onPhone.sync(ALICE)
  assert.deepEqual(phone.json(QUOTES_KEY).map(q => [q.id, q.status]), [['q1', 'sent']])
})

await step('syncing again changes nothing', async () => {
  for (const e of [onPhone, onLaptop]) assert.deepEqual(await e.sync(ALICE), { applied: [], pushed: 0, renumbered: [], replacedDevice: false })
})

const aliceBusiness = onPhone.readMeta().businessId

await step('another signed-in person cannot read the first person\'s data', async () => {
  for (const table of ['documents', 'quotes', 'businesses', 'business_members']) {
    const { data, error } = await bob.from(table).select('*')
    assert.equal(error, null)
    assert.deepEqual(data, [], `bob can see rows in ${table}`)
  }
  const { data } = await bob.from('quotes').select('*').eq('business_id', aliceBusiness)
  assert.deepEqual(data, [])
})

await step('another signed-in person cannot write into the first person\'s business', async () => {
  const stamp = new Date().toISOString()
  const insert = await bob.from('quotes').upsert({ business_id: aliceBusiness, id: 'planted', data: { x: 1 }, updated_at: stamp, deleted_at: null }, { onConflict: 'business_id,id' })
  assert.ok(insert.error, 'bob planted a quote in alice\'s business')
  const overwrite = await bob.from('documents').upsert({ business_id: aliceBusiness, kind: 'prices', data: { hacked: true }, updated_at: stamp }, { onConflict: 'business_id,kind' })
  assert.ok(overwrite.error, 'bob overwrote alice\'s prices')
  await bob.from('quotes').delete().eq('business_id', aliceBusiness)
  await bob.from('quotes').update({ data: { hacked: true }, updated_at: stamp }).eq('business_id', aliceBusiness)
  const { data } = await alice.from('quotes').select('id, data').eq('business_id', aliceBusiness).is('deleted_at', null)
  assert.deepEqual(data.map(r => r.id), ['q1'])
  assert.equal(data[0].data.customerName, 'Harbour Freight')
  const prices = await alice.from('documents').select('data').eq('kind', 'prices').single()
  assert.equal(prices.data.data.pricing.markupPercent, 25)
})

await step('the second person gets their own, separate business', async () => {
  const bobDevice = device()
  bobDevice.put(QUOTES_KEY, [quote('q1', 'Q2026-0001', { customerName: 'Bob\'s customer' })])
  const engine = createSyncEngine({ storage: bobDevice, remote: createSupabaseRemote(bob) })
  await engine.sync(BOB)
  assert.notEqual(engine.readMeta().businessId, aliceBusiness)
  const { data } = await alice.from('quotes').select('id, data').is('deleted_at', null)
  assert.deepEqual(data.map(r => r.data.customerName), ['Harbour Freight'])
})

await step('a visitor who is not signed in gets nothing', async () => {
  const visitor = clientFor(null)
  for (const table of ['documents', 'quotes', 'businesses', 'business_members']) {
    const { data, error } = await visitor.from(table).select('*')
    assert.ok(error || data.length === 0, `a visitor can read ${table}`)
  }
  assert.ok((await visitor.rpc('ensure_business')).error, 'a visitor created a business')
})

await step('an older change cannot overwrite a newer one', async () => {
  const old = new Date(Date.now() - 86400000).toISOString()
  await alice.from('documents').upsert({ business_id: aliceBusiness, kind: 'prices', data: { stale: true }, updated_at: old }, { onConflict: 'business_id,kind' })
  const { data } = await alice.from('documents').select('data').eq('kind', 'prices').single()
  assert.equal(data.data.stale, undefined)
})

await step('deleting online data removes it, and only for that person', async () => {
  await bob.from('businesses').delete().eq('id', aliceBusiness) // must do nothing
  assert.equal((await alice.from('quotes').select('id').is('deleted_at', null)).data.length, 1)
  await createSupabaseRemote(alice).deleteBusiness(aliceBusiness)
  assert.deepEqual((await alice.from('quotes').select('id')).data, [])
  assert.deepEqual((await alice.from('documents').select('kind')).data, [])
  assert.equal((await bob.from('quotes').select('id')).data.length, 1)
})

console.log('ALL API INTEGRATION TESTS PASSED')
