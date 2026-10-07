// Accounts and online storage for the app.
//
// This is switched on by two settings at build time (see .env.example). Without them the app
// behaves exactly as it always has: everything stays on the device and none of this code,
// including the Supabase library, is loaded.
import { createSyncEngine, DOCUMENT_KEYS, QUOTES_KEY } from './engine'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const accountsEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)
export const googleSignInEnabled = accountsEnabled && import.meta.env.VITE_AUTH_GOOGLE === '1'

const browserStorage = {
  get(key) { try { return localStorage.getItem(key) } catch (e) { return null } },
  set(key, value) { try { localStorage.setItem(key, value); return true } catch (e) { return false } },
  remove(key) { try { localStorage.removeItem(key) } catch (e) { /* nothing to remove */ } }
}

// ----- What the account screen shows -----
// status: 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'
let state = { ready: !accountsEnabled, status: 'signed-out', email: '', lastSyncedAt: null, error: '', notice: '' }
const listeners = new Set()
const setState = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach(fn => fn(state))
}
export const getAccountState = () => state
export function subscribeAccount(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let supabase = null
let engine = null
let session = null
let onApplied = () => {}
let timer = null
let lastRun = 0

/** The app tells us how to reload its screens after synced data lands on the device. */
export function setOnApplied(fn) {
  onApplied = fn || (() => {})
}

async function runSync() {
  if (!engine || !session) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState({ status: 'offline' })
    return
  }
  setState({ status: 'syncing', error: '' })
  try {
    const result = await engine.sync(session.user.id)
    lastRun = Date.now()
    const notes = []
    if (result.replacedDevice) notes.push('This device had another account\'s data on it. That was set aside and replaced with this account\'s.')
    for (const r of result.renumbered) notes.push(`${r.from} was used on two devices, so one of them is now ${r.to}.`)
    if (result.applied.length) onApplied(result.applied)
    setState({ status: 'synced', lastSyncedAt: engine.readMeta().lastSyncedAt, ...(notes.length ? { notice: notes.join(' ') } : {}) })
  } catch (e) {
    setState({ status: 'error', error: e.message || 'Could not sync.' })
  }
}

function scheduleSync(delay = 1500) {
  if (!session) return
  clearTimeout(timer)
  timer = setTimeout(runSync, delay)
}

/** Sync straight away (the "Sync now" button). */
export function syncNow() {
  clearTimeout(timer)
  return runSync()
}

/** Called by the app whenever it saves something to the device. */
export function noteLocalChange(storageKey) {
  if (!accountsEnabled) return
  if (storageKey !== QUOTES_KEY && !Object.values(DOCUMENT_KEYS).includes(storageKey)) return
  ensureEngine().noteLocalChange(storageKey)
  scheduleSync()
}

/** Called by the app when a saved quote is deleted, so the deletion reaches other devices. */
export function noteQuoteDeleted(id) {
  if (!accountsEnabled) return
  ensureEngine().noteQuoteDeleted(id)
}

// Local changes are timestamped even while signed out, so the newest change can still win later.
// Until someone signs in there is no online side, so the engine gets a remote that refuses.
function ensureEngine() {
  if (!engine) engine = createSyncEngine({ storage: browserStorage, remote: offlineRemote })
  return engine
}
const refuse = async () => { throw new Error('Not logged in.') }
const offlineRemote = { ensureBusiness: refuse, fetchDocuments: refuse, fetchQuotes: refuse, upsertDocuments: refuse, upsertQuotes: refuse }

function applySession(next) {
  session = next
  if (!session) {
    clearTimeout(timer)
    setState({ ready: true, status: 'signed-out', email: '', error: '' })
    return
  }
  setState({ ready: true, email: session.user.email || '', lastSyncedAt: engine.readMeta().lastSyncedAt })
  runSync()
}

let started = false
/** Start accounts: load Supabase, pick up an existing sign-in, and keep syncing in the background. */
export async function initAccounts() {
  if (!accountsEnabled || started) return
  started = true
  try {
    const [{ createClient }, { createSupabaseRemote }] = await Promise.all([import('@supabase/supabase-js'), import('./supabaseRemote')])
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    engine = createSyncEngine({ storage: browserStorage, remote: createSupabaseRemote(supabase) })

    supabase.auth.onAuthStateChange((_event, next) => {
      // Supabase asks that nothing awaits it inside this callback
      setTimeout(() => {
        const changed = (next?.user?.id || null) !== (session?.user?.id || null)
        if (changed || !state.ready) applySession(next)
        else session = next // refreshed token, same person
      }, 0)
    })

    window.addEventListener('online', () => scheduleSync(300))
    window.addEventListener('offline', () => session && setState({ status: 'offline' }))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun > 60000) scheduleSync(300)
    })
    setInterval(() => { if (document.visibilityState === 'visible') scheduleSync(0) }, 5 * 60000)
  } catch (e) {
    setState({ ready: true, status: 'error', error: 'Accounts could not be loaded. The app still works on this device.' })
  }
}

// Sign-in links come back to the page the person was on
const returnUrl = () => window.location.origin + window.location.pathname

/** Email a sign-in link. No password is stored anywhere. */
export async function signInWithEmail(email) {
  if (!supabase) throw new Error('Accounts are still loading. Try again in a moment.')
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: returnUrl() } })
  if (error) throw new Error(error.message)
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Accounts are still loading. Try again in a moment.')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } })
  if (error) throw new Error(error.message)
}

/** Sign out of this device. What's on the device stays on the device. */
export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** Remove everything this account has stored online, then sign out. The device keeps its copy. */
export async function deleteOnlineData() {
  if (!supabase || !session) throw new Error('Log in first.')
  const businessId = engine.readMeta().businessId || (await supabase.rpc('ensure_business')).data
  const { error } = await supabase.from('businesses').delete().eq('id', businessId)
  if (error) throw new Error(error.message)
  engine.unlink()
  await supabase.auth.signOut()
}

export function dismissNotice() {
  setState({ notice: '' })
}
