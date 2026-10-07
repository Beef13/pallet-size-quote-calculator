// The price list: timber types, their board and bearer sizes, the price of each per metre,
// the nail price, and the labour / markup / GST settings.
//
// A business that hasn't touched the list gets the standard one that ships with the app
// (so improvements to it reach them). Once they add, rename or remove anything, the list is
// theirs (`listEdited: true`) and is kept exactly as they left it.

// Labour is per pallet. Markup is either a percentage added to cost (markupType 'percent':
// sell = cost x (1 + markup%)) or a dollar amount per pallet (markupType 'amount':
// sell = cost + markupAmount). Both figures are kept, so switching between them loses nothing.
// GST is added to the quoted total.
export const DEFAULT_PRICING = {
  labourPerPallet: 0,
  markupPercent: 0,
  markupType: 'percent',
  markupAmount: 0,
  gstRate: 10,
  showGst: true
}

export function mergePricing(saved) {
  const p = { ...DEFAULT_PRICING }
  if (saved && typeof saved === 'object') {
    for (const key of ['labourPerPallet', 'markupPercent', 'markupAmount', 'gstRate']) {
      if (saved[key] !== undefined && saved[key] !== '') p[key] = Math.max(0, Number(saved[key]) || 0)
    }
    if (saved.markupType === 'amount' || saved.markupType === 'percent') p.markupType = saved.markupType
    if (typeof saved.showGst === 'boolean') p.showGst = saved.showGst
  }
  return p
}

const PRICE_KEY = { board: 'pricePerBoard', bearer: 'pricePerBearer' }
const LIST_KEY = { board: 'boardSizes', bearer: 'bearerSizes' }
const money = (v) => Math.max(0, Number(v) || 0)

/** Build a size entry from a width and thickness in mm, or null if either isn't a positive number. */
export function makeSize(width, thickness, kind = 'board', price = 0) {
  const w = Math.round(Number(width))
  const t = Math.round(Number(thickness))
  if (!(w > 0) || !(t > 0) || w > 1000 || t > 1000) return null
  return { id: `${w}x${t}`, dimensions: `${w}x${t}mm`, width: w, thickness: t, [PRICE_KEY[kind]]: money(price) }
}

const bySize = (a, b) => a.width - b.width || a.thickness - b.thickness

// Keep only well-formed sizes, one per id
function cleanSizes(list, kind) {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(list) ? list : []) {
    const size = makeSize(raw?.width, raw?.thickness, kind, raw?.[PRICE_KEY[kind]])
    if (!size || seen.has(size.id)) continue
    seen.add(size.id)
    out.push(size)
  }
  return out
}

function cleanTypes(types) {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(types) ? types : []) {
    const id = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const type = {
      id,
      name: String(raw.name || '').trim() || 'Timber',
      boardSizes: cleanSizes(raw.boardSizes, 'board'),
      bearerSizes: cleanSizes(raw.bearerSizes, 'bearer')
    }
    if (raw.shortName && String(raw.shortName).trim()) type.shortName = String(raw.shortName).trim()
    out.push(type)
  }
  return out
}

/**
 * Turn whatever was saved or imported into a complete, valid price list.
 * - Nothing saved, or a list that was never edited: the standard list with any saved prices
 *   laid over it, so an old or partial file can never remove a timber type or size.
 * - An edited list: used as saved, after dropping anything malformed.
 */
export function mergePrices(defaults, saved) {
  const merged = JSON.parse(JSON.stringify(defaults))
  merged.pricing = mergePricing(saved?.pricing)
  merged.listEdited = false
  if (!saved || typeof saved !== 'object') return merged

  if (saved.nailPricePerNail !== undefined && saved.nailPricePerNail !== '') {
    merged.nailPricePerNail = money(saved.nailPricePerNail)
  }

  if (saved.listEdited === true && Array.isArray(saved.timberTypes)) {
    merged.timberTypes = cleanTypes(saved.timberTypes)
    merged.listEdited = true
    return merged
  }

  merged.timberTypes.forEach(type => {
    const savedType = saved.timberTypes?.find(t => t.id === type.id)
    if (!savedType) return
    for (const kind of ['board', 'bearer']) {
      type[LIST_KEY[kind]].forEach(size => {
        const savedSize = savedType[LIST_KEY[kind]]?.find(s => s.id === size.id)
        const value = savedSize?.[PRICE_KEY[kind]]
        if (value !== undefined && value !== '') size[PRICE_KEY[kind]] = Number(value) || 0
      })
    }
  })
  return merged
}

// ----- Editing the list. Each returns a new price list and marks it as edited. -----

const editType = (prices, typeId, change) => ({
  ...prices,
  listEdited: true,
  timberTypes: prices.timberTypes.map(type => (type.id === typeId ? change(type) : type))
})

/** Add a size to a timber type. Returns the same list untouched if the size is invalid or already there. */
export function addSize(prices, typeId, kind, width, thickness) {
  const size = makeSize(width, thickness, kind)
  const type = prices.timberTypes.find(t => t.id === typeId)
  if (!size || !type || type[LIST_KEY[kind]].some(s => s.id === size.id)) return prices
  return editType(prices, typeId, t => ({ ...t, [LIST_KEY[kind]]: [...t[LIST_KEY[kind]], size].sort(bySize) }))
}

export function removeSize(prices, typeId, kind, sizeId) {
  return editType(prices, typeId, t => ({ ...t, [LIST_KEY[kind]]: t[LIST_KEY[kind]].filter(s => s.id !== sizeId) }))
}

export function renameType(prices, typeId, name) {
  // A new name replaces the short label too, so the dropdowns show what was typed
  return editType(prices, typeId, ({ shortName, ...t }) => ({ ...t, name }))
}

export function addType(prices, id, name = 'New timber') {
  if (prices.timberTypes.some(t => t.id === id)) return prices
  return { ...prices, listEdited: true, timberTypes: [...prices.timberTypes, { id, name, boardSizes: [], bearerSizes: [] }] }
}

export function removeType(prices, typeId) {
  return { ...prices, listEdited: true, timberTypes: prices.timberTypes.filter(t => t.id !== typeId) }
}

/** Back to the standard list, keeping the nail price and the labour / markup / GST settings. */
export function resetList(defaults, prices) {
  return mergePrices(defaults, { nailPricePerNail: prices.nailPricePerNail, pricing: prices.pricing })
}
