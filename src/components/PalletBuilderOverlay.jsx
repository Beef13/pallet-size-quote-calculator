import { useState, useEffect, useMemo } from 'react'
import { flushSync } from 'react-dom'
import timberData from '../data/timber-prices.json'
import { calculateTotalPrice, deckGapSize, maxDeckBoards, timberCost, formatCurrency, formatDimension } from '../utils/calculations'
import Pallet3DLive from './Pallet3DLive'
import LockIcon from './LockIcon'
import PrintableQuote from './PrintableQuote'
import '../styles/Workbench.css'

// Look up a board or bearer size in the bundled timber data
function findSize(typeId, sizeId, kind = 'board') {
  if (!typeId || !sizeId) return null
  const type = timberData.timberTypes.find(t => t.id === typeId)
  const list = kind === 'bearer' ? type?.bearerSizes : type?.boardSizes
  return list?.find(s => s.id === sizeId) || null
}

function sizesForType(typeId, kind = 'board') {
  const type = timberData.timberTypes.find(t => t.id === typeId)
  if (!type) return []
  return kind === 'bearer' ? type.bearerSizes : type.boardSizes
}

// Pricing settings that sit on top of the timber cost.
// Labour is per pallet, markup is a percentage added to cost
// (sell = cost x (1 + markup%)), GST is added to the quoted total.
const DEFAULT_PRICING = {
  labourPerPallet: 0,
  markupPercent: 0,
  gstRate: 10,
  showGst: true
}

const DEFAULT_BUSINESS = {
  name: '',
  abn: '',
  phone: '',
  email: '',
  address: '',
  validDays: 30
}

function mergePricing(saved) {
  const p = { ...DEFAULT_PRICING }
  if (saved && typeof saved === 'object') {
    for (const key of ['labourPerPallet', 'markupPercent', 'gstRate']) {
      if (saved[key] !== undefined && saved[key] !== '') p[key] = Math.max(0, Number(saved[key]) || 0)
    }
    if (typeof saved.showGst === 'boolean') p.showGst = saved.showGst
  }
  return p
}

// Merge saved/imported price values onto the current timber data structure,
// so old or partial price files can never remove timber types or sizes.
function mergePrices(saved) {
  const merged = JSON.parse(JSON.stringify(timberData))
  merged.pricing = mergePricing(saved?.pricing)
  if (!saved || typeof saved !== 'object') return merged
  merged.timberTypes.forEach(type => {
    const savedType = saved.timberTypes?.find(t => t.id === type.id)
    if (!savedType) return
    type.boardSizes.forEach(size => {
      const savedSize = savedType.boardSizes?.find(s => s.id === size.id)
      if (savedSize && savedSize.pricePerBoard !== undefined && savedSize.pricePerBoard !== '') {
        size.pricePerBoard = Number(savedSize.pricePerBoard) || 0
      }
    })
    type.bearerSizes.forEach(size => {
      const savedSize = savedType.bearerSizes?.find(s => s.id === size.id)
      if (savedSize && savedSize.pricePerBearer !== undefined && savedSize.pricePerBearer !== '') {
        size.pricePerBearer = Number(savedSize.pricePerBearer) || 0
      }
    })
  })
  if (saved.nailPricePerNail !== undefined && saved.nailPricePerNail !== '') {
    merged.nailPricePerNail = Number(saved.nailPricePerNail) || 0
  }
  return merged
}

function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    return false
  }
}

const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', lost: 'Lost' }
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10

// Small line icons (stroke follows text colour)
function Icon({ name, size = 18 }) {
  const paths = {
    panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    minus: <path d="M6 12h12" />,
    plus: <path d="M12 6v12M6 12h12" />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

// Number stepper used for board, bearer and pallet counts.
// The number can be typed as well as stepped; it is kept within min..max
// when the field loses focus (or Enter is pressed). With allowEmpty, a
// blank field means "not chosen yet" (board and bearer counts).
function Stepper({ value, onChange, min = 1, max = 15, label, id, allowEmpty = false }) {
  const raw = value == null ? '' : String(value)
  const n = parseInt(raw) || 0
  const clamp = (v) => String(Math.max(min, Math.min(max, v)))
  const step = (delta) => onChange(clamp(n ? n + delta : min))
  const commit = () => {
    if (raw === '') {
      if (!allowEmpty) onChange(String(min))
      return
    }
    if (n < min || n > max || String(n) !== raw) onChange(clamp(n || min))
  }
  // Size the field to its digits so large numbers are never cropped
  const digits = Math.max(2, raw.length, String(max).length > 3 ? 3 : 2)
  return (
    <div className="stepper" role="group" aria-labelledby={id} data-empty={allowEmpty && n === 0 ? '' : undefined}>
      <button type="button" className="stepper-btn" onClick={() => step(-1)}
        disabled={n !== 0 && n <= min} aria-label={`Fewer ${label}`}>
        <Icon name="minus" size={16} />
      </button>
      <input
        className="stepper-value"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={raw}
        placeholder="–"
        aria-label={`Number of ${label}`}
        style={{ width: `calc(${digits}ch + 20px)` }}
        onChange={(e) => { if (/^\d{0,4}$/.test(e.target.value)) onChange(e.target.value) }}
        onBlur={commit}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(); e.target.blur() }
          if (e.key === 'ArrowUp') { e.preventDefault(); step(1) }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(-1) }
        }}
      />
      <button type="button" className="stepper-btn" onClick={() => step(1)}
        disabled={n >= max} aria-label={`More ${label}`}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}

// Price with the cents shown lighter, e.g. $12<span>.92</span>
function Money({ value }) {
  const [whole, cents] = formatCurrency(value).split('.')
  return <>{whole}<span className="cents">.{cents}</span></>
}

// Animated open/close wrapper. The content stays mounted and its height is animated with a
// grid row going from 0fr to 1fr, so nothing around it jumps. Hidden content can't be
// focused or read by screen readers.
function Reveal({ open, id, className = '', children }) {
  return (
    <div className={`reveal ${open ? 'shown' : ''} ${className}`} id={id} inert={open ? undefined : ''} aria-hidden={open ? undefined : true}>
      <div className="reveal-clip">{children}</div>
    </div>
  )
}

// Short line beside a section title that fills as the section is completed:
// empty track (nothing chosen), part filled (partly done), full and green (done)
const STATUS_TEXT = { todo: 'not started', partial: 'not finished', done: 'done' }
function StatusMark({ status, ratio = 0 }) {
  return (
    <span className={`status-mark ${status}`} role="img" aria-label={STATUS_TEXT[status]} title={STATUS_TEXT[status].replace(/^./, c => c.toUpperCase())}>
      <span className="status-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </span>
  )
}

// A panel section that folds down to its heading and a one-line summary
function Fold({ id, title, summary, cost, aside, status, ratio, open, onToggle, className = 'form-section', children }) {
  return (
    <section className={`${className} fold ${open ? 'open' : ''}`} aria-label={title} data-fold={id}>
      <div className="section-head fold-head">
        <h2>
          <button type="button" className="fold-toggle" aria-expanded={open} aria-controls={`fold-${id}`} onClick={() => onToggle(id)}>
            <span className="chevron" aria-hidden="true" />
            {title}
          </button>
        </h2>
        <div className="fold-aside">
          {aside && <div className={`fold-aside-extra ${open ? 'shown' : ''}`} inert={open ? undefined : ''}>{aside}</div>}
          {cost > 0 && <span className="section-cost">{formatCurrency(cost)}</span>}
          {/* Always last, so the lines sit in one column down the right edge */}
          {status && <StatusMark status={status} ratio={ratio} />}
        </div>
      </div>
      <Reveal open={!open}>
        <button type="button" className="fold-summary" tabIndex={-1} onClick={() => onToggle(id)}>{summary}</button>
      </Reveal>
      <Reveal open={open} id={`fold-${id}`}>
        <div className="fold-body">{children}</div>
      </Reveal>
    </section>
  )
}

function PalletBuilderOverlay({ onQuoteCalculated, quoteData }) {
  // Panel collapsed state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = readStorage('palletDarkMode')
    if (saved === 'true' || saved === 'false') return saved === 'true'
    // No choice saved yet: follow the device setting
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  })
  
  // Tab state
  const [activeTab, setActiveTab] = useState('calculator')
  
  // Form state
  const [palletWidth, setPalletWidth] = useState('')
  const [palletLength, setPalletLength] = useState('')
  const [selectedTopBoardType, setSelectedTopBoardType] = useState('')
  const [selectedTopBoardSize, setSelectedTopBoardSize] = useState('')
  const [selectedBottomBoardType, setSelectedBottomBoardType] = useState('')
  const [selectedBottomBoardSize, setSelectedBottomBoardSize] = useState('')
  const [numberOfTopBoards, setNumberOfTopBoards] = useState('')
  const [numberOfBottomBoards, setNumberOfBottomBoards] = useState('')
  
  // Custom leader boards (edge boards with different size)
  const [useCustomTopLeaders, setUseCustomTopLeaders] = useState(false)
  const [selectedTopLeaderType, setSelectedTopLeaderType] = useState('')
  const [selectedTopLeaderSize, setSelectedTopLeaderSize] = useState('')
  const [useCustomBottomLeaders, setUseCustomBottomLeaders] = useState(false)
  const [selectedBottomLeaderType, setSelectedBottomLeaderType] = useState('')
  const [selectedBottomLeaderSize, setSelectedBottomLeaderSize] = useState('')
  const [selectedBearerType, setSelectedBearerType] = useState('')
  const [selectedBearerSize, setSelectedBearerSize] = useState('')
  const [numberOfBearers, setNumberOfBearers] = useState('')
  const [error, setError] = useState('')
  const [palletQuantity, setPalletQuantity] = useState('1')
  const quantity = Math.max(1, parseInt(palletQuantity) || 1)
  
  // Price editor state
  const [prices, setPrices] = useState({ timberTypes: [] })
  const [lockedFields, setLockedFields] = useState(new Set())
  const [expandedGroups, setExpandedGroups] = useState(new Set(['pine-green-case'])) // First group expanded by default
  
  // Saved presets state
  const [savedPresets, setSavedPresets] = useState([])

  // Which panel sections are folded open. Remembered between visits; sections the user
  // hasn't touched fall back to a sensible default (see isOpen below).
  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = JSON.parse(readStorage('palletOpenSections') || '{}')
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    } catch (e) {
      return {}
    }
  })
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [pricesSaved, setPricesSaved] = useState(true)
  const [saveFlash, setSaveFlash] = useState(false)

  // Business details shown on the customer PDF (saved on this device)
  const [business, setBusiness] = useState(() => {
    try {
      return { ...DEFAULT_BUSINESS, ...(JSON.parse(readStorage('palletBusiness') || 'null') || {}) }
    } catch (e) {
      return { ...DEFAULT_BUSINESS }
    }
  })
  // Fold the business section away if the details were already filled in when the app opened
  // (decided once, so it doesn't snap shut while the name is being typed)
  const [businessOpenByDefault] = useState(() => !String(business.name || '').trim())
  const updateBusiness = (key, value) => {
    setBusiness(prev => {
      const next = { ...prev, [key]: value }
      writeStorage('palletBusiness', JSON.stringify(next))
      return next
    })
  }

  // Who the current quote is for
  const [customerName, setCustomerName] = useState('')
  const [customerRef, setCustomerRef] = useState('')

  // Quote history: each saved quote keeps its design, quantity, customer and
  // the exact rates it was priced on, under a sequential quote number.
  const [quotes, setQuotes] = useState(() => {
    try {
      const saved = JSON.parse(readStorage('palletQuotes') || '[]')
      return Array.isArray(saved) ? saved : []
    } catch (e) {
      return []
    }
  })
  const [currentQuoteId, setCurrentQuoteId] = useState(null)
  // When an old quote is opened, its saved rates are used instead of today's
  const [ratesFromQuote, setRatesFromQuote] = useState(null)
  const [historyNotice, setHistoryNotice] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Available sizes - derived from the selected timber type
  const availableTopBoardSizes = useMemo(() => sizesForType(selectedTopBoardType), [selectedTopBoardType])
  const availableBottomBoardSizes = useMemo(() => sizesForType(selectedBottomBoardType), [selectedBottomBoardType])
  const availableTopLeaderSizes = useMemo(() => sizesForType(selectedTopLeaderType), [selectedTopLeaderType])
  const availableBottomLeaderSizes = useMemo(() => sizesForType(selectedBottomLeaderType), [selectedBottomLeaderType])
  const availableBearerSizes = useMemo(() => sizesForType(selectedBearerType, 'bearer'), [selectedBearerType])

  // Changing a timber type clears its size (done in the handler, not an effect,
  // so loading a preset can set type and size together)
  const changeTopBoardType = (v) => { setSelectedTopBoardType(v); setSelectedTopBoardSize('') }
  const changeBottomBoardType = (v) => { setSelectedBottomBoardType(v); setSelectedBottomBoardSize('') }
  const changeTopLeaderType = (v) => { setSelectedTopLeaderType(v); setSelectedTopLeaderSize('') }
  const changeBottomLeaderType = (v) => { setSelectedBottomLeaderType(v); setSelectedBottomLeaderSize('') }
  const changeBearerType = (v) => { setSelectedBearerType(v); setSelectedBearerSize('') }

  // Save and apply dark mode
  useEffect(() => {
    writeStorage('palletDarkMode', JSON.stringify(isDarkMode))
    document.documentElement.classList.toggle('dark-mode', isDarkMode)
  }, [isDarkMode])

  // Load prices - merge saved prices with current timber data structure
  useEffect(() => {
    let saved = null
    try {
      saved = JSON.parse(readStorage('timberPrices') || 'null')
    } catch (e) {
      console.log('Could not read saved prices, using defaults')
    }
    setPrices(mergePrices(saved))
    
    const allFieldIds = []
    timberData.timberTypes.forEach(type => {
      type.boardSizes.forEach(size => allFieldIds.push(`${type.id}-board-${size.id}`))
      type.bearerSizes.forEach(size => allFieldIds.push(`${type.id}-bearer-${size.id}`))
    })
    allFieldIds.push('nails')
    // Labour, markup and GST share one lock
    allFieldIds.push('pricing')
    setLockedFields(new Set(allFieldIds))
  }, [])

  // Load saved presets from localStorage
  useEffect(() => {
    const saved = readStorage('palletPresets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setSavedPresets(parsed)
      } catch (e) {
        console.log('Could not load saved presets')
      }
    }
  }, [])

  // Everything that describes the pallet design (used by presets and quotes)
  const designSnapshot = () => ({
    palletWidth,
    palletLength,
    selectedTopBoardType,
    selectedTopBoardSize,
    selectedBottomBoardType,
    selectedBottomBoardSize,
    numberOfTopBoards,
    numberOfBottomBoards,
    useCustomTopLeaders,
    selectedTopLeaderType,
    selectedTopLeaderSize,
    useCustomBottomLeaders,
    selectedBottomLeaderType,
    selectedBottomLeaderSize,
    selectedBearerType,
    selectedBearerSize,
    numberOfBearers
  })

  // Save preset to localStorage
  const savePreset = () => {
    if (!newPresetName.trim()) return
    
    const preset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      palletWidth,
      palletLength,
      selectedTopBoardType,
      selectedTopBoardSize,
      selectedBottomBoardType,
      selectedBottomBoardSize,
      numberOfTopBoards,
      numberOfBottomBoards,
      useCustomTopLeaders,
      selectedTopLeaderType,
      selectedTopLeaderSize,
      useCustomBottomLeaders,
      selectedBottomLeaderType,
      selectedBottomLeaderSize,
      selectedBearerType,
      selectedBearerSize,
      numberOfBearers
    }
    
    // Saving with an existing name replaces that preset
    const updatedPresets = [...savedPresets.filter(p => p.name !== preset.name), preset]
    setSavedPresets(updatedPresets)
    writeStorage('palletPresets', JSON.stringify(updatedPresets))
    setNewPresetName('')
    setShowSavePresetModal(false)
  }

  // Load a saved preset
  const loadPreset = (preset) => {
    setPalletWidth(preset.palletWidth || '')
    setPalletLength(preset.palletLength || '')
    // Support both old and new preset formats
    setSelectedTopBoardType(preset.selectedTopBoardType || preset.selectedBoardType || '')
    setSelectedTopBoardSize(preset.selectedTopBoardSize || preset.selectedBoardSize || '')
    setSelectedBottomBoardType(preset.selectedBottomBoardType || preset.selectedBoardType || '')
    setSelectedBottomBoardSize(preset.selectedBottomBoardSize || preset.selectedBoardSize || '')
    setNumberOfTopBoards(preset.numberOfTopBoards || '')
    setNumberOfBottomBoards(preset.numberOfBottomBoards || '')
    // Leader board settings
    setUseCustomTopLeaders(preset.useCustomTopLeaders || false)
    setSelectedTopLeaderType(preset.selectedTopLeaderType || '')
    setSelectedTopLeaderSize(preset.selectedTopLeaderSize || '')
    setUseCustomBottomLeaders(preset.useCustomBottomLeaders || false)
    setSelectedBottomLeaderType(preset.selectedBottomLeaderType || '')
    setSelectedBottomLeaderSize(preset.selectedBottomLeaderSize || '')
    // Bearer settings
    setSelectedBearerType(preset.selectedBearerType || '')
    setSelectedBearerSize(preset.selectedBearerSize || '')
    setNumberOfBearers(preset.numberOfBearers || '')
    setError('')
  }

  // Delete a saved preset
  const deletePreset = (presetId) => {
    const updatedPresets = savedPresets.filter(p => p.id !== presetId)
    setSavedPresets(updatedPresets)
    writeStorage('palletPresets', JSON.stringify(updatedPresets))
  }

  // Export presets to JSON file
  const exportPresets = () => {
    // Always export today's saved prices, even while an old quote is open
    let savedPrices = prices
    try { savedPrices = mergePrices(JSON.parse(readStorage('timberPrices') || 'null')) } catch (e) { /* keep current */ }
    const dataToExport = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      presets: savedPresets,
      prices: savedPrices,
      business,
      quotes
    }
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pallet-quote-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import presets from JSON file
  const importPresets = (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        const messages = []
        if (data.presets && Array.isArray(data.presets)) {
          // Merge imported presets with existing (avoid duplicates by name)
          const existingNames = new Set(savedPresets.map(p => p.name))
          const newPresets = data.presets.filter(p => p && p.name && !existingNames.has(p.name))
          const mergedPresets = [...savedPresets, ...newPresets.map((p, i) => ({ ...p, id: `${Date.now()}-${i}` }))]
          setSavedPresets(mergedPresets)
          writeStorage('palletPresets', JSON.stringify(mergedPresets))
          const skipped = data.presets.length - newPresets.length
          messages.push(`Imported ${newPresets.length} preset${newPresets.length === 1 ? '' : 's'}` +
            (skipped > 0 ? ` (${skipped} skipped - same name already exists)` : ''))
        }
        if (Array.isArray(data.quotes)) {
          // Add quotes that aren't already here (matched by quote number)
          const have = new Set(quotes.map(q => q.number))
          const incoming = data.quotes.filter(q => q && q.number && !have.has(q.number))
          if (incoming.length) persistQuotes([...quotes, ...incoming].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')))
          messages.push(`Imported ${incoming.length} quote${incoming.length === 1 ? '' : 's'}`)
        }
        if (data.business && typeof data.business === 'object' && !business.name) {
          const next = { ...DEFAULT_BUSINESS, ...data.business }
          setBusiness(next)
          writeStorage('palletBusiness', JSON.stringify(next))
          messages.push('Business details imported')
        }
        if (data.prices) {
          // Only take price values - never replace the timber list itself
          const merged = mergePrices(data.prices)
          setPrices(merged)
          writeStorage('timberPrices', JSON.stringify(merged))
          setPricesSaved(true)
          messages.push('Prices updated')
        }
        alert(messages.length ? messages.join('\n') : 'Nothing to import in that file.')
      } catch (err) {
        alert('Error importing file. Please check the file format.')
      }
    }
    reader.readAsText(file)
    event.target.value = '' // Reset file input
  }

  // Resolved sizes for the current selections (dimensions from the bundled data)
  const topBoardDims = findSize(selectedTopBoardType, selectedTopBoardSize)
  const bottomBoardDims = findSize(selectedBottomBoardType, selectedBottomBoardSize)
  const topLeaderDims = useCustomTopLeaders ? findSize(selectedTopLeaderType, selectedTopLeaderSize) : null
  const bottomLeaderDims = useCustomBottomLeaders ? findSize(selectedBottomLeaderType, selectedBottomLeaderSize) : null
  const bearerDims = findSize(selectedBearerType, selectedBearerSize, 'bearer')

  const currentTopBoardWidth = topBoardDims?.width || 0
  const currentBottomBoardWidth = bottomBoardDims?.width || 0
  const currentBearerThickness = bearerDims?.thickness || 0

  // Calculate max boards that can fit without overlapping (leader boards included)
  // Returns -1 when we shouldn't apply any limit (partial input or unreasonably small width)
  const maxBoardsFor = (widthValue, boardWidth, leaderWidth) => {
    const width = parseFloat(widthValue) || 0
    const widest = Math.max(boardWidth || 0, leaderWidth || 0)
    if (!widest) return 15 // No board size selected, allow all
    // Require minimum 2 boards worth of width to be considered "complete"
    // (prevents adjustments while the width is still being typed)
    if (!width || width < widest * 2) return -1
    return maxDeckBoards(width, boardWidth || leaderWidth, leaderWidth || null, 15)
  }

  const maxTopBoardsAllowed = useMemo(
    () => maxBoardsFor(palletWidth, currentTopBoardWidth, topLeaderDims?.width),
    [palletWidth, currentTopBoardWidth, topLeaderDims?.width]
  )
  const maxBottomBoardsAllowed = useMemo(
    () => maxBoardsFor(palletWidth, currentBottomBoardWidth, bottomLeaderDims?.width),
    [palletWidth, currentBottomBoardWidth, bottomLeaderDims?.width]
  )

  // For UI display - show 15 when not limiting
  const maxTopBoardsForUI = maxTopBoardsAllowed === -1 ? 15 : maxTopBoardsAllowed
  const maxBottomBoardsForUI = maxBottomBoardsAllowed === -1 ? 15 : maxBottomBoardsAllowed

  // Calculate max bearers that can fit along the length without overlapping
  const maxBearersAllowed = useMemo(() => {
    const length = parseFloat(palletLength) || 0
    if (!currentBearerThickness) {
      return 15 // No bearer size selected, allow all
    }
    const minReasonableLength = currentBearerThickness * 2
    if (!length || length < minReasonableLength) {
      return -1 // Invalid/partial length - don't limit
    }
    const maxBearers = Math.floor(length / currentBearerThickness)
    return Math.max(1, Math.min(15, maxBearers)) // Cap at 15
  }, [palletLength, currentBearerThickness])

  // For UI display - show 15 when not limiting
  const maxBearersForUI = maxBearersAllowed === -1 ? 15 : maxBearersAllowed

  // Auto-adjust top boards when max changes (only if valid limit and boards selected)
  useEffect(() => {
    if (maxTopBoardsAllowed > 0 && numberOfTopBoards) {
      const boards = parseInt(numberOfTopBoards) || 0
      if (boards > maxTopBoardsAllowed) {
        setNumberOfTopBoards(String(maxTopBoardsAllowed))
      }
    }
  }, [maxTopBoardsAllowed, numberOfTopBoards])

  // Auto-adjust bottom boards when max changes (only if valid limit and boards selected)
  useEffect(() => {
    if (maxBottomBoardsAllowed > 0 && numberOfBottomBoards) {
      const boards = parseInt(numberOfBottomBoards) || 0
      if (boards > maxBottomBoardsAllowed) {
        setNumberOfBottomBoards(String(maxBottomBoardsAllowed))
      }
    }
  }, [maxBottomBoardsAllowed, numberOfBottomBoards])

  // Auto-adjust bearers when max changes (only if valid limit and bearers selected)
  useEffect(() => {
    if (maxBearersAllowed > 0 && numberOfBearers) {
      const bearers = parseInt(numberOfBearers) || 0
      if (bearers > maxBearersAllowed) {
        setNumberOfBearers(String(maxBearersAllowed))
      }
    }
  }, [maxBearersAllowed, numberOfBearers])

  // Compute the actual displayed value for selects (capped to max)
  const displayedTopBoards = numberOfTopBoards && maxTopBoardsAllowed > 0
    ? String(Math.min(parseInt(numberOfTopBoards) || 1, maxTopBoardsAllowed))
    : numberOfTopBoards
  const displayedBottomBoards = numberOfBottomBoards && maxBottomBoardsAllowed > 0
    ? String(Math.min(parseInt(numberOfBottomBoards) || 1, maxBottomBoardsAllowed))
    : numberOfBottomBoards
  const displayedBearers = numberOfBearers && maxBearersAllowed > 0
    ? String(Math.min(parseInt(numberOfBearers) || 1, maxBearersAllowed))
    : numberOfBearers

  // Live preview data
  const livePreviewData = useMemo(() => {
    const width = parseFloat(palletWidth) || 0
    const length = parseFloat(palletLength) || 0
    // Use capped values for 3D preview
    const topBoards = parseInt(displayedTopBoards) || 0
    const bottomBoards = parseInt(displayedBottomBoards) || 0
    const bearers = parseInt(displayedBearers) || 0

    // Board dimensions (defaults used until a size is picked)
    const topBoardWidth = topBoardDims?.width || 100
    const topBoardThickness = topBoardDims?.thickness || 22
    const bottomBoardWidth = bottomBoardDims?.width || 100
    const bottomBoardThickness = bottomBoardDims?.thickness || 22

    // Leader (edge) boards fall back to the normal board size
    const topLeaderWidth = topLeaderDims?.width || topBoardWidth
    const topLeaderThickness = topLeaderDims?.thickness || topBoardThickness
    const bottomLeaderWidth = bottomLeaderDims?.width || bottomBoardWidth
    const bottomLeaderThickness = bottomLeaderDims?.thickness || bottomBoardThickness

    // Bearer dimensions
    const bearerWidth = bearerDims?.width || 75
    const bearerHeight = bearerDims?.thickness || 38

    // Same gap maths as the quote, so the 3D view always matches it
    const topGap = deckGapSize(width, topBoards, topBoardWidth, useCustomTopLeaders ? topLeaderWidth : null)
    const bottomGap = deckGapSize(width, bottomBoards, bottomBoardWidth, useCustomBottomLeaders ? bottomLeaderWidth : null)

    return {
      palletWidth: width,
      palletLength: length,
      topBoardWidth,
      topBoardThickness,
      topLeaderWidth: useCustomTopLeaders ? topLeaderWidth : topBoardWidth,
      topLeaderThickness: useCustomTopLeaders ? topLeaderThickness : topBoardThickness,
      useCustomTopLeaders,
      bottomBoardWidth,
      bottomBoardThickness,
      bottomLeaderWidth: useCustomBottomLeaders ? bottomLeaderWidth : bottomBoardWidth,
      bottomLeaderThickness: useCustomBottomLeaders ? bottomLeaderThickness : bottomBoardThickness,
      useCustomBottomLeaders,
      bearerWidth,
      bearerHeight,
      numberOfTopBoards: topBoards,
      numberOfBottomBoards: bottomBoards,
      numberOfBearers: bearers,
      topGapSize: Math.max(0, topGap),
      bottomGapSize: Math.max(0, bottomGap)
    }
  }, [palletWidth, palletLength, displayedTopBoards, displayedBottomBoards, displayedBearers, topBoardDims, bottomBoardDims, topLeaderDims, bottomLeaderDims, bearerDims, useCustomTopLeaders, useCustomBottomLeaders])

  // Real-time progressive quote calculation - updates as each element is added.
  // Timber prices are per lineal metre: top/bottom boards run the pallet LENGTH,
  // bearers run the pallet WIDTH (matches the 3D model).
  const liveQuote = useMemo(() => {
    const width = parseFloat(palletWidth) || 0
    const length = parseFloat(palletLength) || 0
    // Use capped values for quote calculation
    const topBoards = parseInt(displayedTopBoards) || 0
    const bottomBoards = parseInt(displayedBottomBoards) || 0
    const bearers = parseInt(displayedBearers) || 0

    const findPriced = (typeId, sizeId, kind = 'board') => {
      const type = prices.timberTypes.find(t => t.id === typeId)
      const list = kind === 'bearer' ? type?.bearerSizes : type?.boardSizes
      return { type, size: list?.find(s => s.id === sizeId) }
    }

    const { type: topBoardTimberType, size: topBoardSize } = findPriced(selectedTopBoardType, selectedTopBoardSize)
    const { type: topLeaderTimberType, size: topLeaderSize } = findPriced(selectedTopLeaderType, selectedTopLeaderSize)
    const { type: bottomBoardTimberType, size: bottomBoardSize } = findPriced(selectedBottomBoardType, selectedBottomBoardSize)
    const { type: bottomLeaderTimberType, size: bottomLeaderSize } = findPriced(selectedBottomLeaderType, selectedBottomLeaderSize)
    const { type: bearerTimberType, size: bearerSize } = findPriced(selectedBearerType, selectedBearerSize, 'bearer')

    const boardLength = length // mm - each top/bottom board
    const bearerLength = width // mm - each bearer

    // Work out one deck (top or bottom) of boards
    const deck = (count, useLeaders, boardSize, leaderSize) => {
      const result = { inner: count, leaders: 0, innerTotal: 0, leadersTotal: 0, gap: 0 }
      if (count <= 0) return result
      if (useLeaders && leaderSize && count >= 2) {
        result.leaders = 2
        result.inner = count - 2
        result.leadersTotal = timberCost(leaderSize.pricePerBoard, boardLength, 2)
        if (boardSize && result.inner > 0) {
          result.innerTotal = timberCost(boardSize.pricePerBoard, boardLength, result.inner)
        }
        if (width > 0 && (boardSize || result.inner === 0)) {
          result.gap = deckGapSize(width, count, boardSize?.width || 0, leaderSize.width)
        }
      } else if (boardSize) {
        result.innerTotal = timberCost(boardSize.pricePerBoard, boardLength, count)
        if (width > 0) result.gap = deckGapSize(width, count, boardSize.width)
      }
      return result
    }

    const top = deck(topBoards, useCustomTopLeaders, topBoardSize, topLeaderSize)
    const bottom = deck(bottomBoards, useCustomBottomLeaders, bottomBoardSize, bottomLeaderSize)

    const bearersTotal = (bearerSize && bearers > 0) ? timberCost(bearerSize.pricePerBearer, bearerLength, bearers) : 0

    // Nails: 2 per board per bearer, top and bottom
    const nailPrice = Number(prices.nailPricePerNail) || 0
    let totalNails = 0
    if (topBoards > 0 && bearers > 0) totalNails += topBoards * bearers * 2
    if (bottomBoards > 0 && bearers > 0) totalNails += bottomBoards * bearers * 2
    const nailsTotal = totalNails > 0 ? parseFloat(calculateTotalPrice(nailPrice, totalNails)) : 0

    const round2 = (v) => Math.round(v * 100) / 100
    const materialsTotal = round2(top.leadersTotal + top.innerTotal + bottom.leadersTotal + bottom.innerTotal + bearersTotal + nailsTotal)

    // Cost stack: materials + labour = cost; cost + markup = sell price (per pallet)
    const pricing = prices.pricing || DEFAULT_PRICING
    const hasMaterials = materialsTotal > 0 || totalNails > 0
    const labourPerPallet = hasMaterials ? round2(Number(pricing.labourPerPallet) || 0) : 0
    const costPerPallet = round2(materialsTotal + labourPerPallet)
    const markupPercent = Number(pricing.markupPercent) || 0
    const markupPerPallet = round2(costPerPallet * markupPercent / 100)
    const runningTotal = round2(costPerPallet + markupPerPallet)
    const marginPercent = runningTotal > 0 ? (markupPerPallet / runningTotal) * 100 : 0

    // When using custom leaders, also need leader type/size selected
    const topLeadersValid = !useCustomTopLeaders || (topLeaderTimberType && topLeaderSize)
    const bottomLeadersValid = !useCustomBottomLeaders || (bottomLeaderTimberType && bottomLeaderSize)

    // Boards must physically fit across the pallet
    const topFits = top.gap >= 0
    const bottomFits = bottom.gap >= 0

    const isComplete = !!(width > 0 && length > 0 && topBoards > 0 && bottomBoards > 0 &&
                       bearers > 0 && topBoardTimberType && bottomBoardTimberType && bearerTimberType &&
                       topBoardSize && bottomBoardSize && bearerSize && topLeadersValid && bottomLeadersValid &&
                       topFits && bottomFits)

    return {
      topBoardTimberType: topBoardTimberType?.name || '',
      bottomBoardTimberType: bottomBoardTimberType?.name || '',
      bearerTimberType: bearerTimberType?.name || '',
      topBoardSize: topBoardSize?.dimensions || '',
      bottomBoardSize: bottomBoardSize?.dimensions || '',
      bearerSize: bearerSize?.dimensions || '',
      // Leader board info
      useCustomTopLeaders,
      topLeaderTimberType: topLeaderTimberType?.name || '',
      topLeaderSize: topLeaderSize?.dimensions || '',
      topLeaderWidth: topLeaderSize?.width || 0,
      topLeaderThickness: topLeaderSize?.thickness || 0,
      topLeaderCount: top.leaders,
      topInnerBoards: top.inner,
      useCustomBottomLeaders,
      bottomLeaderTimberType: bottomLeaderTimberType?.name || '',
      bottomLeaderSize: bottomLeaderSize?.dimensions || '',
      bottomLeaderWidth: bottomLeaderSize?.width || 0,
      bottomLeaderThickness: bottomLeaderSize?.thickness || 0,
      bottomLeaderCount: bottom.leaders,
      bottomInnerBoards: bottom.inner,
      // Board counts
      numberOfTopBoards: topBoards,
      numberOfBearers: bearers,
      numberOfBottomBoards: bottomBoards,
      // Lengths of each piece (mm)
      boardLength,
      bearerLength,
      // Prices per metre
      pricePerTopBoard: Number(topBoardSize?.pricePerBoard) || 0,
      pricePerBottomBoard: Number(bottomBoardSize?.pricePerBoard) || 0,
      pricePerTopLeader: Number(topLeaderSize?.pricePerBoard) || 0,
      pricePerBottomLeader: Number(bottomLeaderSize?.pricePerBoard) || 0,
      pricePerBearer: Number(bearerSize?.pricePerBearer) || 0,
      // Totals
      topBoardsTotal: top.innerTotal,
      topLeadersTotal: top.leadersTotal,
      bottomBoardsTotal: bottom.innerTotal,
      bottomLeadersTotal: bottom.leadersTotal,
      bearersTotal,
      totalNails,
      pricePerNail: nailPrice,
      nailsTotal,
      // Price per pallet (ex GST) and how it is built up
      materialsTotal,
      labourPerPallet,
      costPerPallet,
      markupPercent,
      markupPerPallet,
      marginPercent,
      totalPrice: runningTotal,
      gstRate: Number(pricing.gstRate) || 0,
      showGst: pricing.showGst !== false,
      palletWidth: width,
      palletLength: length,
      topBoardWidth: topBoardSize?.width || 0,
      topBoardThickness: topBoardSize?.thickness || 0,
      bottomBoardWidth: bottomBoardSize?.width || 0,
      bottomBoardThickness: bottomBoardSize?.thickness || 0,
      bearerWidth: bearerSize?.width || 0,
      bearerThickness: bearerSize?.thickness || 0,
      topGapSize: top.gap,
      bottomGapSize: bottom.gap,
      topFits,
      bottomFits,
      isComplete,
      hasAnyPrice: hasMaterials
    }
  }, [palletWidth, palletLength, displayedTopBoards, displayedBottomBoards, displayedBearers, selectedTopBoardType, selectedTopBoardSize, selectedBottomBoardType, selectedBottomBoardSize, selectedBearerType, selectedBearerSize, prices, useCustomTopLeaders, selectedTopLeaderType, selectedTopLeaderSize, useCustomBottomLeaders, selectedBottomLeaderType, selectedBottomLeaderSize])

  // Warnings shown under the form
  const layoutWarnings = []
  if (!liveQuote.topFits) layoutWarnings.push("Top boards don't fit across the pallet width - reduce the number of boards or use narrower leader boards.")
  if (!liveQuote.bottomFits) layoutWarnings.push("Bottom boards don't fit across the pallet width - reduce the number of boards or use narrower leader boards.")

  // ---------- Quote history ----------

  const persistQuotes = (list) => {
    setQuotes(list)
    writeStorage('palletQuotes', JSON.stringify(list))
  }

  // Sequential numbers per year: Q2026-0001, Q2026-0002 ...
  const nextQuoteNumber = (existing) => {
    const year = new Date().getFullYear()
    const prefix = `Q${year}-`
    const highest = existing
      .map(q => (q.number || '').startsWith(prefix) ? parseInt(q.number.slice(prefix.length)) || 0 : 0)
      .reduce((a, b) => Math.max(a, b), 0)
    const stored = parseInt(readStorage(`palletQuoteSeq-${year}`)) || 0
    const seq = Math.max(highest, stored) + 1
    writeStorage(`palletQuoteSeq-${year}`, String(seq))
    return `${prefix}${String(seq).padStart(4, '0')}`
  }

  const cleanPrices = () => mergePrices(prices)
  const signatureOf = (design, qty, name, ref, priceList) =>
    JSON.stringify([design, String(qty), name.trim(), ref.trim(), priceList])
  const currentQuote = quotes.find(q => q.id === currentQuoteId) || null
  const currentSignature = signatureOf(designSnapshot(), quantity, customerName, customerRef, cleanPrices())
  const isQuoteDirty = !currentQuote || currentQuote.signature !== currentSignature

  // Save the current quote. Drafts are updated in place; a quote that has
  // already been sent keeps its record and the changes get a new number.
  const saveQuote = ({ markSent = false } = {}) => {
    if (!liveQuote.hasAnyPrice) return null
    const now = new Date().toISOString()
    const record = {
      design: designSnapshot(),
      quantity,
      customerName: customerName.trim(),
      customerRef: customerRef.trim(),
      prices: cleanPrices(),
      summary: {
        size: liveQuote.palletWidth && liveQuote.palletLength ? `${liveQuote.palletWidth} × ${liveQuote.palletLength}` : '',
        pricePerPallet: liveQuote.totalPrice,
        totalExGst: Math.round(liveQuote.totalPrice * quantity * 100) / 100,
        complete: liveQuote.isComplete
      },
      signature: currentSignature,
      updatedAt: now
    }

    let list = [...quotes]
    let saved
    if (currentQuote && !isQuoteDirty) {
      saved = currentQuote
    } else if (currentQuote && currentQuote.status === 'draft') {
      saved = { ...currentQuote, ...record }
      list = list.map(q => q.id === saved.id ? saved : q)
    } else {
      saved = { id: `${Date.now()}`, number: nextQuoteNumber(list), status: 'draft', createdAt: now, ...record }
      if (currentQuote) {
        setHistoryNotice(`${currentQuote.number} was already ${currentQuote.status}, so these changes were saved as ${saved.number}.`)
      }
      list = [saved, ...list]
    }
    if (markSent && saved.status === 'draft') {
      saved = { ...saved, status: 'sent', sentAt: now }
      list = list.map(q => q.id === saved.id ? saved : q)
    }
    persistQuotes(list)
    setCurrentQuoteId(saved.id)
    return saved
  }

  const useTodaysRates = () => {
    let saved = null
    try { saved = JSON.parse(readStorage('timberPrices') || 'null') } catch (e) { saved = null }
    setPrices(mergePrices(saved))
    setRatesFromQuote(null)
  }

  const applyQuote = (q) => {
    loadPreset(q.design || {})
    setPalletQuantity(String(q.quantity || 1))
    setCustomerName(q.customerName || '')
    setCustomerRef(q.customerRef || '')
  }

  // Reopen a quote exactly as it was priced
  const openQuote = (q) => {
    applyQuote(q)
    setPrices(mergePrices(q.prices))
    setRatesFromQuote(q.number)
    setCurrentQuoteId(q.id)
    setHistoryNotice('')
    setActiveTab('quote')
  }

  // Start a new quote from an old one, priced at today's rates
  const duplicateQuote = (q) => {
    applyQuote(q)
    useTodaysRates()
    setCurrentQuoteId(null)
    setHistoryNotice(`Copied from ${q.number} at today's rates. It gets its own number when you save or export it.`)
    setActiveTab('quote')
  }

  const setQuoteStatus = (id, status) => {
    persistQuotes(quotes.map(q => q.id === id ? { ...q, status, updatedAt: new Date().toISOString() } : q))
  }

  const deleteQuote = (id) => {
    persistQuotes(quotes.filter(q => q.id !== id))
    if (id === currentQuoteId) setCurrentQuoteId(null)
    setConfirmDeleteId(null)
  }

  // PDF export: 'customer' (spec + total) or 'breakdown' (internal costs).
  // Saves the quote first (so it has a number and its rates are kept),
  // renders the chosen layout, names the file, then opens the print dialog
  // where "Save as PDF" can be chosen.
  const [printVariant, setPrintVariant] = useState('customer')
  const [quoteRef, setQuoteRef] = useState('')
  const exportPdf = (variant) => {
    const saved = saveQuote({ markSent: variant === 'customer' })
    const ref = saved?.number || ''
    flushSync(() => {
      setPrintVariant(variant)
      setQuoteRef(ref)
    })
    const size = liveQuote.palletWidth && liveQuote.palletLength ? ` ${liveQuote.palletWidth}x${liveQuote.palletLength}` : ''
    const previousTitle = document.title
    document.title = `${variant === 'customer' ? 'Pallet quote' : 'Pallet cost breakdown'}${size} ${ref}`
    const restore = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  const handleClear = () => {
    setPalletWidth('')
    setPalletLength('')
    setSelectedTopBoardType('')
    setSelectedTopBoardSize('')
    setSelectedBottomBoardType('')
    setSelectedBottomBoardSize('')
    setNumberOfTopBoards('')
    setNumberOfBottomBoards('')
    // Reset leader board settings
    setUseCustomTopLeaders(false)
    setSelectedTopLeaderType('')
    setSelectedTopLeaderSize('')
    setUseCustomBottomLeaders(false)
    setSelectedBottomLeaderType('')
    setSelectedBottomLeaderSize('')
    // Reset bearer settings
    setSelectedBearerType('')
    setSelectedBearerSize('')
    setNumberOfBearers('')
    setError('')
    setPalletQuantity('1')
    setCustomerName('')
    setCustomerRef('')
    setCurrentQuoteId(null)
    setHistoryNotice('')
    if (ratesFromQuote) useTodaysRates()
    onQuoteCalculated(null)
  }

  // One lock covers labour, markup and GST; a saved quote's rates can't be edited either
  const pricingLocked = lockedFields.has('pricing') || !!ratesFromQuote

  const toggleLock = (fieldId) => {
    const newLockedFields = new Set(lockedFields)
    if (newLockedFields.has(fieldId)) {
      newLockedFields.delete(fieldId)
    } else {
      newLockedFields.add(fieldId)
    }
    setLockedFields(newLockedFields)
  }

  // Get all field IDs for a category
  const getCategoryFieldIds = (categoryId) => {
    if (categoryId === 'hardware') {
      return ['nails']
    }
    const type = timberData.timberTypes.find(t => t.id === categoryId)
    if (!type) return []
    const boardIds = type.boardSizes.map(s => `${categoryId}-board-${s.id}`)
    const bearerIds = type.bearerSizes.map(s => `${categoryId}-bearer-${s.id}`)
    return [...boardIds, ...bearerIds]
  }

  // Check if all fields in a category are locked
  const isCategoryLocked = (categoryId) => {
    const fieldIds = getCategoryFieldIds(categoryId)
    return fieldIds.length > 0 && fieldIds.every(id => lockedFields.has(id))
  }

  // Toggle all locks in a category
  const toggleCategoryLock = (categoryId, e) => {
    e.stopPropagation() // Prevent toggle from expanding/collapsing
    const fieldIds = getCategoryFieldIds(categoryId)
    const newLockedFields = new Set(lockedFields)
    const allLocked = isCategoryLocked(categoryId)
    
    fieldIds.forEach(id => {
      if (allLocked) {
        newLockedFields.delete(id)
      } else {
        newLockedFields.add(id)
      }
    })
    setLockedFields(newLockedFields)
  }

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  // Keep an empty field empty while the user is typing (treated as $0 in the maths)
  const parsePriceInput = (value) => {
    if (value === '') return ''
    const n = parseFloat(value)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  const handlePriceChange = (typeId, sizeId, newPrice, itemType) => {
    const value = parsePriceInput(newPrice)
    const key = itemType === 'board' ? 'pricePerBoard' : 'pricePerBearer'
    const listKey = itemType === 'board' ? 'boardSizes' : 'bearerSizes'
    setPrices(prev => ({
      ...prev,
      timberTypes: prev.timberTypes.map(type => type.id !== typeId ? type : {
        ...type,
        [listKey]: type[listKey].map(size => size.id !== sizeId ? size : { ...size, [key]: value })
      })
    }))
    setPricesSaved(false)
  }

  const handleNailPriceChange = (newPrice) => {
    const value = parsePriceInput(newPrice)
    setPrices(prev => ({ ...prev, nailPricePerNail: value }))
    setPricesSaved(false)
  }

  // Labour, markup and GST settings (saved with the prices)
  const handlePricingChange = (key, value) => {
    const v = key === 'showGst' ? !!value : parsePriceInput(value)
    setPrices(prev => ({ ...prev, pricing: { ...(prev.pricing || DEFAULT_PRICING), [key]: v } }))
    setPricesSaved(false)
  }

  const handleSavePrices = () => {
    const cleaned = mergePrices(prices)
    setPrices(cleaned)
    if (writeStorage('timberPrices', JSON.stringify(cleaned))) {
      setPricesSaved(true)
      setSaveFlash(true)
      setTimeout(() => setSaveFlash(false), 2000)
    } else {
      alert('Could not save prices on this device (storage is unavailable).')
    }
  }

  // Pallet quantity - whole numbers only
  const handleQuantityChange = (val) => {
    if (val === '' || /^\d+$/.test(val)) setPalletQuantity(val)
  }
  const handleQuantityBlur = () => {
    if (palletQuantity === '' || parseInt(palletQuantity) < 1) setPalletQuantity('1')
  }

  const sectionCosts = {
    bottom: liveQuote.bottomBoardsTotal + liveQuote.bottomLeadersTotal,
    top: liveQuote.topBoardsTotal + liveQuote.topLeadersTotal,
    bearers: liveQuote.bearersTotal
  }

  const timberOptions = timberData.timberTypes.map(type => (
    <option key={type.id} value={type.id} title={type.name}>{type.shortName || type.name}</option>
  ))

  const sizeOptions = (sizes) => sizes.map(size => (
    <option key={size.id} value={size.id}>{size.dimensions.replace('x', ' × ')}</option>
  ))

  const maxNote = (max) => (max > 0 && max < 15 ? <span className="field-note">up to {max}</span> : null)

  // Sections start open, except: presets when there are none yet, and business details
  // once they were already filled in when the app opened.
  const sectionDefaults = { presets: savedPresets.length > 0, business: businessOpenByDefault }
  const isOpen = (id) => openSections[id] ?? sectionDefaults[id] ?? true
  const toggleSection = (id) => {
    const next = { ...openSections, [id]: !isOpen(id) }
    setOpenSections(next)
    writeStorage('palletOpenSections', JSON.stringify(next))
  }
  const fold = (id) => ({ id, open: isOpen(id), onToggle: toggleSection })

  // One-line summaries shown while a section is folded
  const timberName = (typeId) => {
    const type = timberData.timberTypes.find(t => t.id === typeId)
    return type ? (type.shortName || type.name) : ''
  }
  const dims = (sizes, sizeId) => {
    const size = sizes.find(sz => sz.id === sizeId)
    return size ? size.dimensions.replace('x', ' × ') : ''
  }
  const timberSummary = ({ count, noun, type, size, sizes, leaders, leaderSize, leaderSizes }) => {
    const sizeText = dims(sizes, size)
    if (!type || !sizeText) return 'Not chosen yet'
    const n = parseInt(count) || 0
    const parts = [n > 0 ? `${n} ${n === 1 ? noun : noun + 's'}` : 'Count not set', `${sizeText} ${timberName(type)}`]
    const leaderText = leaders ? dims(leaderSizes || [], leaderSize) : ''
    if (leaderText) parts.push(`${leaderText} leaders`)
    return parts.join(' · ')
  }
  const sizeSummary = palletWidth && palletLength ? `${palletWidth} × ${palletLength} mm` : 'No size entered yet'
  const businessSummary = [business.name, business.phone || business.email].map(v => (v || '').trim()).filter(Boolean).join(' · ')
    || 'Add your details for customer quotes'

  // How far along each part of the build is: 'todo', 'partial' or 'done'
  const progress = (checks) => {
    const done = checks.filter(Boolean).length
    return { status: done === 0 ? 'todo' : done === checks.length ? 'done' : 'partial', ratio: done / checks.length }
  }
  const deckChecks = (type, size, count, leaders, leaderType, leaderSize) => [
    !!type, !!size, (parseInt(count) || 0) > 0,
    ...(leaders ? [!!leaderType, !!leaderSize] : [])
  ]
  const buildProgress = {
    size: progress([Number(palletWidth) > 0, Number(palletLength) > 0]),
    bottom: progress(deckChecks(selectedBottomBoardType, selectedBottomBoardSize, displayedBottomBoards, useCustomBottomLeaders, selectedBottomLeaderType, selectedBottomLeaderSize)),
    top: progress(deckChecks(selectedTopBoardType, selectedTopBoardSize, displayedTopBoards, useCustomTopLeaders, selectedTopLeaderType, selectedTopLeaderSize)),
    bearers: progress(deckChecks(selectedBearerType, selectedBearerSize, displayedBearers))
  }
  // Plain-English list of what's left, for the price card
  const missingParts = [['size', 'pallet size'], ['bottom', 'bottom boards'], ['top', 'top boards'], ['bearers', 'bearers']]
    .filter(([key]) => buildProgress[key].status !== 'done').map(([, name]) => name)
  const missingText = missingParts.length === 0 ? ''
    : missingParts.length === 1 ? missingParts[0]
    : `${missingParts.slice(0, -1).join(', ')} and ${missingParts[missingParts.length - 1]}`
  const empty = (value) => (value ? undefined : '')

  // One deck of boards (top or bottom) - the two sections share the same controls
  const renderDeck = (deck) => {
    const isTop = deck === 'top'
    const p = isTop ? {
      type: selectedTopBoardType, setType: changeTopBoardType, size: selectedTopBoardSize, setSize: setSelectedTopBoardSize,
      sizes: availableTopBoardSizes, count: displayedTopBoards, setCount: setNumberOfTopBoards, max: maxTopBoardsAllowed,
      maxUI: maxTopBoardsForUI, leaders: useCustomTopLeaders, setLeaders: setUseCustomTopLeaders,
      leaderType: selectedTopLeaderType, setLeaderType: changeTopLeaderType, leaderSize: selectedTopLeaderSize,
      setLeaderSize: setSelectedTopLeaderSize, leaderSizes: availableTopLeaderSizes
    } : {
      type: selectedBottomBoardType, setType: changeBottomBoardType, size: selectedBottomBoardSize, setSize: setSelectedBottomBoardSize,
      sizes: availableBottomBoardSizes, count: displayedBottomBoards, setCount: setNumberOfBottomBoards, max: maxBottomBoardsAllowed,
      maxUI: maxBottomBoardsForUI, leaders: useCustomBottomLeaders, setLeaders: setUseCustomBottomLeaders,
      leaderType: selectedBottomLeaderType, setLeaderType: changeBottomLeaderType, leaderSize: selectedBottomLeaderSize,
      setLeaderSize: setSelectedBottomLeaderSize, leaderSizes: availableBottomLeaderSizes
    }
    return (
      <Fold {...fold(deck)} title={isTop ? 'Top boards' : 'Bottom boards'} cost={sectionCosts[deck]} {...buildProgress[deck]}
        summary={timberSummary({ count: p.count, noun: 'board', type: p.type, size: p.size, sizes: p.sizes, leaders: p.leaders, leaderSize: p.leaderSize, leaderSizes: p.leaderSizes })}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Timber</span>
            <select value={p.type} onChange={(e) => p.setType(e.target.value)} data-field={`${deck}-type`} data-empty={empty(p.type)}>
              <option value="">Choose timber</option>
              {timberOptions}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Size</span>
            <select value={p.size} onChange={(e) => p.setSize(e.target.value)} disabled={!p.type} data-field={`${deck}-size`} data-empty={empty(p.size)}>
              <option value="">{p.type ? 'Choose size' : 'Choose timber first'}</option>
              {sizeOptions(p.sizes)}
            </select>
          </label>
        </div>
        <div className="field field-inline">
          <span className="field-label" id={`${deck}-count-label`}>Boards {maxNote(p.max)}</span>
          <Stepper id={`${deck}-count-label`} label={`${deck} boards`} value={p.count} onChange={p.setCount} max={p.maxUI} allowEmpty />
        </div>
        <label className="switch">
          <input type="checkbox" checked={p.leaders} onChange={(e) => p.setLeaders(e.target.checked)} data-field={`${deck}-leaders`} />
          <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
          <span>Different leader boards on the outside edges</span>
        </label>
        {p.leaders && (
          <div className="field-row nested">
            <label className="field">
              <span className="field-label">Leader timber</span>
              <select value={p.leaderType} onChange={(e) => p.setLeaderType(e.target.value)} data-field={`${deck}-leader-type`} data-empty={empty(p.leaderType)}>
                <option value="">Choose timber</option>
                {timberOptions}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Leader size</span>
              <select value={p.leaderSize} onChange={(e) => p.setLeaderSize(e.target.value)} disabled={!p.leaderType} data-field={`${deck}-leader-size`} data-empty={empty(p.leaderSize)}>
                <option value="">{p.leaderType ? 'Choose size' : 'Choose timber first'}</option>
                {sizeOptions(p.leaderSizes)}
              </select>
            </label>
          </div>
        )}
      </Fold>
    )
  }

  const lineItems = [
    liveQuote.topLeaderCount > 0 && {
      name: 'Top leader boards', amount: liveQuote.topLeadersTotal,
      detail: `${liveQuote.topLeaderCount} × ${liveQuote.topLeaderSize.replace('x', ' × ')}, ${formatDimension(liveQuote.boardLength)} long`
    },
    liveQuote.topBoardSize && liveQuote.topInnerBoards > 0 && {
      name: 'Top boards', amount: liveQuote.topBoardsTotal,
      detail: `${liveQuote.topInnerBoards} × ${liveQuote.topBoardSize.replace('x', ' × ')}, ${formatDimension(liveQuote.boardLength)} long`
    },
    liveQuote.bottomLeaderCount > 0 && {
      name: 'Bottom leader boards', amount: liveQuote.bottomLeadersTotal,
      detail: `${liveQuote.bottomLeaderCount} × ${liveQuote.bottomLeaderSize.replace('x', ' × ')}, ${formatDimension(liveQuote.boardLength)} long`
    },
    liveQuote.bottomBoardSize && liveQuote.bottomInnerBoards > 0 && {
      name: 'Bottom boards', amount: liveQuote.bottomBoardsTotal,
      detail: `${liveQuote.bottomInnerBoards} × ${liveQuote.bottomBoardSize.replace('x', ' × ')}, ${formatDimension(liveQuote.boardLength)} long`
    },
    liveQuote.bearerSize && liveQuote.numberOfBearers > 0 && {
      name: 'Bearers', amount: liveQuote.bearersTotal,
      detail: `${liveQuote.numberOfBearers} × ${liveQuote.bearerSize.replace('x', ' × ')}, ${formatDimension(liveQuote.bearerLength)} long`
    },
    liveQuote.totalNails > 0 && {
      name: 'Nails', amount: liveQuote.nailsTotal,
      detail: `${liveQuote.totalNails} at ${formatCurrency(liveQuote.pricePerNail)} each`
    }
  ].filter(Boolean)

  // Quote totals: ex GST, GST and the grand total
  const totals = (() => {
    const exGst = Math.round(liveQuote.totalPrice * quantity * 100) / 100
    const gst = liveQuote.showGst ? Math.round(exGst * liveQuote.gstRate) / 100 : 0
    return { exGst, gst, grand: Math.round((exGst + gst) * 100) / 100 }
  })()

  const totalLabel = liveQuote.isComplete
    ? `${quantity > 1 ? `Total for ${quantity} pallets` : 'Total'}${liveQuote.showGst ? ' ex GST' : ''}`
    : 'Running total'

  const tabs = [
    { id: 'calculator', label: 'Build' },
    { id: 'quote', label: 'Quote' },
    { id: 'history', label: 'Quotes' },
    { id: 'prices', label: 'Prices' }
  ]

  return (
    <div className={`workbench ${isPanelCollapsed ? 'panel-collapsed' : ''}`}>
      {/* Left panel */}
      <aside className="panel" aria-hidden={isPanelCollapsed}>
        <header className="panel-header">
          <div className="brand">
            <span className="brand-logo" aria-hidden="true">
              {/* A pallet seen side-on: deck board over three blocks */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="7" width="18" height="3.5" rx="1" />
                <rect x="4" y="12" width="3.5" height="4" rx="0.8" />
                <rect x="10.25" y="12" width="3.5" height="4" rx="0.8" />
                <rect x="16.5" y="12" width="3.5" height="4" rx="0.8" />
                <rect x="3" y="17" width="18" height="2.5" rx="1" />
              </svg>
            </span>
            <span className="brand-mark">Pallet quote</span>
          </div>
          <div className="header-total" aria-hidden="true">
            <span>{totalLabel}</span>
            <strong><Money value={(liveQuote.totalPrice || 0) * quantity} /></strong>
          </div>
          <div className="header-actions">
            <button type="button" className="icon-btn" onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Use light theme' : 'Use dark theme'} aria-label={isDarkMode ? 'Use light theme' : 'Use dark theme'}>
              <Icon name={isDarkMode ? 'sun' : 'moon'} />
            </button>
            <button type="button" className="icon-btn hide-panel-btn" onClick={() => setIsPanelCollapsed(true)}
              title="Hide panel" aria-label="Hide panel">
              <Icon name="panel" />
            </button>
          </div>
        </header>

        <nav className="tabs" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'quote' && liveQuote.hasAnyPrice && (
                <span className={`tab-flag ${liveQuote.isComplete ? 'ready' : ''}`} aria-label={liveQuote.isComplete ? 'complete' : 'in progress'} />
              )}
              {tab.id === 'prices' && !pricesSaved && <span className="tab-flag unsaved" aria-label="unsaved changes" />}
            </button>
          ))}
        </nav>

        {activeTab === 'calculator' && (
          <>
            <div className="panel-body">
              <Fold {...fold('presets')} title="Saved presets" className="form-section presets"
                summary={savedPresets.length > 0 ? `${savedPresets.length} saved` : 'None saved yet'}
                aside={
                  <div className="text-actions">
                    <button type="button" className="text-btn" onClick={exportPresets}>Export</button>
                    <label className="text-btn">
                      Import
                      <input type="file" accept=".json,application/json" onChange={importPresets} hidden />
                    </label>
                  </div>
                }>
                {savedPresets.length > 0 ? (
                  <ul className="preset-list">
                    {savedPresets.map(preset => (
                      <li key={preset.id}>
                        <button type="button" className="preset-load" onClick={() => loadPreset(preset)} title="Load this preset">
                          <span className="preset-name">{preset.name}</span>
                          <span className="preset-size">{preset.palletWidth || '–'} × {preset.palletLength || '–'}</span>
                        </button>
                        <button type="button" className="icon-btn small" onClick={() => deletePreset(preset.id)}
                          title={`Delete ${preset.name}`} aria-label={`Delete ${preset.name}`}>
                          <Icon name="close" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">Save a build you quote often and load it here in one click.</p>
                )}
              </Fold>

              <Fold {...fold('size')} title="Pallet size" summary={sizeSummary} {...buildProgress.size}>
                <label className="field">
                  <span className="field-label">Start from</span>
                  <select
                    value=""
                    data-field="preset"
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.startsWith('saved:')) {
                        const preset = savedPresets.find(p => p.id === value.replace('saved:', ''))
                        if (preset) loadPreset(preset)
                      } else if (value) {
                        const [w, l] = value.split('x')
                        setPalletWidth(w)
                        setPalletLength(l)
                      }
                    }}
                  >
                    <option value="">A standard size or saved preset</option>
                    <optgroup label="Standard sizes">
                      <option value="1165x1165">1165 × 1165 mm</option>
                      <option value="1140x1140">1140 × 1140 mm</option>
                    </optgroup>
                    {savedPresets.length > 0 && (
                      <optgroup label="Saved presets">
                        {savedPresets.map(preset => (
                          <option key={preset.id} value={`saved:${preset.id}`}>{preset.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Width</span>
                    <span className="input-unit">
                      <input type="number" inputMode="numeric" min="0" value={palletWidth} data-field="width" data-empty={empty(Number(palletWidth) > 0)}
                        onChange={(e) => setPalletWidth(e.target.value)} placeholder="1165" />
                      <span className="unit">mm</span>
                    </span>
                  </label>
                  <label className="field">
                    <span className="field-label">Length</span>
                    <span className="input-unit">
                      <input type="number" inputMode="numeric" min="0" value={palletLength} data-field="length" data-empty={empty(Number(palletLength) > 0)}
                        onChange={(e) => setPalletLength(e.target.value)} placeholder="1165" />
                      <span className="unit">mm</span>
                    </span>
                  </label>
                </div>
                <p className="hint">Boards run the length of the pallet. Bearers run across the width.</p>
              </Fold>

              {renderDeck('bottom')}
              {renderDeck('top')}

              <Fold {...fold('bearers')} title="Bearers" cost={sectionCosts.bearers} {...buildProgress.bearers}
                summary={timberSummary({ count: displayedBearers, noun: 'bearer', type: selectedBearerType, size: selectedBearerSize, sizes: availableBearerSizes })}>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Timber</span>
                    <select value={selectedBearerType} onChange={(e) => changeBearerType(e.target.value)} data-field="bearer-type" data-empty={empty(selectedBearerType)}>
                      <option value="">Choose timber</option>
                      {timberOptions}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Size</span>
                    <select value={selectedBearerSize} onChange={(e) => setSelectedBearerSize(e.target.value)} disabled={!selectedBearerType} data-field="bearer-size" data-empty={empty(selectedBearerSize)}>
                      <option value="">{selectedBearerType ? 'Choose size' : 'Choose timber first'}</option>
                      {sizeOptions(availableBearerSizes)}
                    </select>
                  </label>
                </div>
                <div className="field field-inline">
                  <span className="field-label" id="bearer-count-label">Bearers {maxNote(maxBearersAllowed)}</span>
                  <Stepper id="bearer-count-label" label="bearers" value={displayedBearers} onChange={setNumberOfBearers} max={maxBearersForUI} allowEmpty />
                </div>
              </Fold>

              {(error || layoutWarnings.length > 0) && (
                <div className="notice" role="alert">
                  {error && <p>{error}</p>}
                  {layoutWarnings.map(w => <p key={w}>{w}</p>)}
                </div>
              )}

            </div>

            <footer className="panel-footer">
              <button type="button" onClick={handleClear} className="btn btn-quiet">Clear</button>
              <button type="button" onClick={() => setShowSavePresetModal(true)} className="btn btn-secondary">Save as preset</button>
            </footer>

            {showSavePresetModal && (
              <div className="modal-overlay" onClick={() => setShowSavePresetModal(false)}>
                <div className="modal" role="dialog" aria-modal="true" aria-labelledby="save-preset-title" onClick={e => e.stopPropagation()}>
                  <h3 id="save-preset-title">Save as preset</h3>
                  <p>Saves the size, timber and counts so you can load them again later. A preset with the same name is replaced.</p>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. 1165 export, heavy duty"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePreset()
                      if (e.key === 'Escape') setShowSavePresetModal(false)
                    }}
                  />
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowSavePresetModal(false)} className="btn btn-quiet">Cancel</button>
                    <button type="button" onClick={savePreset} className="btn btn-primary" disabled={!newPresetName.trim()}>Save preset</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'quote' && (
          <>
            <div className="panel-body">
              {liveQuote.hasAnyPrice ? (
                <div className="quote">
                  {ratesFromQuote && (
                    <div className="banner">
                      <p>Priced at the rates saved with {ratesFromQuote}.</p>
                      <button type="button" className="text-btn" onClick={useTodaysRates}>Use today's rates</button>
                    </div>
                  )}
                  {historyNotice && (
                    <div className="banner">
                      <p>{historyNotice}</p>
                      <button type="button" className="text-btn" onClick={() => setHistoryNotice('')}>Dismiss</button>
                    </div>
                  )}

                  <div className="quote-meta">
                    <div className="quote-id">
                      <span className="quote-number">{currentQuote ? currentQuote.number : 'New quote'}</span>
                      {currentQuote && <span className={`status-pill status-${currentQuote.status}`}>{STATUS_LABELS[currentQuote.status]}</span>}
                      <span className="save-state">
                        {!currentQuote ? 'Not saved yet' : isQuoteDirty ? 'Unsaved changes' : 'Saved'}
                      </span>
                      <button type="button" className="text-btn" onClick={() => saveQuote()} disabled={!!currentQuote && !isQuoteDirty}>
                        {currentQuote && isQuoteDirty && currentQuote.status !== 'draft' ? 'Save as new quote' : 'Save quote'}
                      </button>
                    </div>
                    <h2>{liveQuote.palletWidth && liveQuote.palletLength
                      ? `${liveQuote.palletWidth} × ${liveQuote.palletLength} mm pallet`
                      : 'Pallet'}</h2>
                    <p className="hint">
                      {liveQuote.isComplete ? 'Ready to export as a customer PDF or a cost breakdown.' : 'Still missing some parts, so this is a running total.'}
                    </p>
                  </div>

                  <div className="field-row customer-row">
                    <label className="field">
                      <span className="field-label">Customer</span>
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Business or person" data-field="customer" />
                    </label>
                    <label className="field">
                      <span className="field-label">Their reference</span>
                      <input type="text" value={customerRef} onChange={(e) => setCustomerRef(e.target.value)}
                        placeholder="PO or job number" data-field="customer-ref" />
                    </label>
                  </div>

                  <ul className="line-items">
                    {lineItems.map(item => (
                      <li key={item.name}>
                        <div>
                          <span className="item-name">{item.name}</span>
                          <span className="item-detail">{item.detail}</span>
                        </div>
                        <span className="item-amount">{formatCurrency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>

                  {(liveQuote.topGapSize > 0 || liveQuote.bottomGapSize > 0) && (
                    <dl className="spec">
                      {liveQuote.topGapSize > 0 && (<><dt>Gap between top boards</dt><dd>{formatDimension(liveQuote.topGapSize)}</dd></>)}
                      {liveQuote.bottomGapSize > 0 && (<><dt>Gap between bottom boards</dt><dd>{formatDimension(liveQuote.bottomGapSize)}</dd></>)}
                    </dl>
                  )}

                  {(layoutWarnings.length > 0 || liveQuote.palletLength <= 0) && (
                    <div className="notice" role="alert">
                      {layoutWarnings.map(w => <p key={w}>{w}</p>)}
                      {liveQuote.palletLength <= 0 && <p>Enter the pallet length. Timber is priced per metre.</p>}
                    </div>
                  )}

                  {liveQuote.markupPercent <= 0 && (
                    <div className="notice">
                      <p>No markup is set, so the price is your cost. Add labour and markup under Prices.</p>
                    </div>
                  )}

                  <div className="totals">
                    <div className="totals-row sub">
                      <span>Materials</span>
                      <span>{formatCurrency(liveQuote.materialsTotal)}</span>
                    </div>
                    {liveQuote.labourPerPallet > 0 && (
                      <div className="totals-row sub">
                        <span>Labour</span>
                        <span>{formatCurrency(liveQuote.labourPerPallet)}</span>
                      </div>
                    )}
                    {liveQuote.markupPercent > 0 && (
                      <div className="totals-row sub">
                        <span>Markup {r1(liveQuote.markupPercent)}% <em className="muted">({r1(liveQuote.marginPercent)}% margin)</em></span>
                        <span>{formatCurrency(liveQuote.markupPerPallet)}</span>
                      </div>
                    )}
                    <div className="totals-row">
                      <span>Price per pallet{liveQuote.showGst ? ' ex GST' : ''}</span>
                      <span>{formatCurrency(liveQuote.totalPrice)}</span>
                    </div>
                    <div className="totals-row">
                      <span id="quote-qty-label">Pallets</span>
                      <Stepper id="quote-qty-label" label="pallets" value={palletQuantity} min={1} max={9999}
                        onChange={(v) => setPalletQuantity(v)} />
                    </div>
                    {liveQuote.showGst && (
                      <>
                        <div className="totals-row">
                          <span>Total ex GST</span>
                          <span>{formatCurrency(totals.exGst)}</span>
                        </div>
                        <div className="totals-row">
                          <span>GST {r1(liveQuote.gstRate)}%</span>
                          <span>{formatCurrency(totals.gst)}</span>
                        </div>
                      </>
                    )}
                    <div className={`totals-row grand ${liveQuote.isComplete ? '' : 'partial'}`}>
                      <span>{liveQuote.isComplete ? (liveQuote.showGst ? 'Total inc GST' : 'Total') : 'Running total'}</span>
                      <span><Money value={totals.grand} /></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  <h2>Nothing to quote yet</h2>
                  <p>Choose timber and board counts in Build. The quote fills in as you go.</p>
                  <button type="button" onClick={() => setActiveTab('calculator')} className="btn btn-secondary">Go to Build</button>
                </div>
              )}
            </div>
            {liveQuote.hasAnyPrice && (
              <footer className="panel-footer">
                <button type="button" onClick={handleClear} className="btn btn-quiet">New quote</button>
                <button type="button" onClick={() => exportPdf('breakdown')} className="btn btn-secondary"
                  title="Full cost breakdown for your own records">Breakdown PDF</button>
                <button type="button" onClick={() => exportPdf('customer')} className="btn btn-primary"
                  title="Drawings, specification and total price to send to the customer">Customer PDF</button>
              </footer>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            <div className="panel-body history">
              <div className="history-head">
                <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by customer, number or size" aria-label="Search saved quotes" data-field="history-search" />
              </div>
              {quotes.length === 0 ? (
                <div className="empty">
                  <h2>No saved quotes yet</h2>
                  <p>Quotes are saved here when you export a PDF or press Save quote. Each one keeps the rates it was priced on.</p>
                  <button type="button" onClick={() => setActiveTab('calculator')} className="btn btn-secondary">Start a quote</button>
                </div>
              ) : (
                <ul className="quote-list">
                  {quotes
                    .filter(q => {
                      const term = historySearch.trim().toLowerCase()
                      if (!term) return true
                      return [q.number, q.customerName, q.customerRef, q.summary?.size].filter(Boolean).join(' ').toLowerCase().includes(term)
                    })
                    .map(q => (
                      <li key={q.id} className={q.id === currentQuoteId ? 'current' : ''}>
                        <div className="quote-row-top">
                          <span className="quote-number">{q.number}</span>
                          <select className={`status-select status-${q.status}`} value={q.status}
                            onChange={(e) => setQuoteStatus(q.id, e.target.value)} aria-label={`Status of ${q.number}`}>
                            {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                          </select>
                        </div>
                        <div className="quote-row-main">
                          <span className="quote-customer">{q.customerName || 'No customer'}</span>
                          <span className="quote-total">{formatCurrency(q.summary?.totalExGst || 0)}</span>
                        </div>
                        <div className="quote-row-sub">
                          <span>{q.summary?.size ? `${q.summary.size} mm` : 'Pallet'} · {q.quantity} pallet{q.quantity === 1 ? '' : 's'}{q.customerRef ? ` · ${q.customerRef}` : ''}</span>
                          <span>{new Date(q.updatedAt || q.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="quote-row-actions">
                          <button type="button" className="text-btn" onClick={() => openQuote(q)}>Open</button>
                          <button type="button" className="text-btn" onClick={() => duplicateQuote(q)}>Duplicate at today's rates</button>
                          {confirmDeleteId === q.id ? (
                            <span className="confirm">
                              Delete {q.number}?
                              <button type="button" className="text-btn danger" onClick={() => deleteQuote(q.id)}>Delete</button>
                              <button type="button" className="text-btn" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                            </span>
                          ) : (
                            <button type="button" className="text-btn muted-btn" onClick={() => setConfirmDeleteId(q.id)}>Delete</button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <footer className="panel-footer">
              <span className="save-state">Totals shown ex GST. Saved on this device.</span>
              <button type="button" className="btn btn-secondary" onClick={exportPresets}>Back up</button>
            </footer>
          </>
        )}

        {activeTab === 'prices' && (
          <>
            <div className="panel-body prices">
              {ratesFromQuote && (
                <div className="banner">
                  <p>You're looking at the rates saved with {ratesFromQuote}. Switch to today's rates to edit them.</p>
                  <button type="button" className="text-btn" onClick={useTodaysRates}>Use today's rates</button>
                </div>
              )}

              {/* Labour, markup and GST */}
              <section className="settings-group" aria-labelledby="pricing-title">
                <div className="section-head">
                  <h2 id="pricing-title">Labour, markup and GST</h2>
                  <LockIcon isLocked={lockedFields.has('pricing')} onClick={() => toggleLock('pricing')} label="labour, markup and GST" />
                </div>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Labour per pallet</span>
                    <span className="input-unit pre">
                      <span className="unit-pre">$</span>
                      <input type="number" min="0" step="0.01" inputMode="decimal" data-field="labour"
                        value={prices.pricing?.labourPerPallet ?? 0} disabled={pricingLocked}
                        onChange={(e) => handlePricingChange('labourPerPallet', e.target.value)} />
                    </span>
                  </label>
                  <label className="field">
                    <span className="field-label">Markup on cost</span>
                    <span className="input-unit">
                      <input type="number" min="0" step="0.5" inputMode="decimal" data-field="markup"
                        value={prices.pricing?.markupPercent ?? 0} disabled={pricingLocked}
                        onChange={(e) => handlePricingChange('markupPercent', e.target.value)} />
                      <span className="unit">%</span>
                    </span>
                  </label>
                </div>
                <p className="hint formula">
                  {(() => {
                    const m = Number(prices.pricing?.markupPercent) || 0
                    const margin = m > 0 ? (m / (100 + m)) * 100 : 0
                    return m > 0
                      ? `Price = cost × ${r1(1 + m / 100)}. A ${r1(m)}% markup gives a ${r1(margin)}% gross margin.`
                      : 'Price = materials + labour. Add a markup to include your profit.'
                  })()}
                </p>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">GST rate</span>
                    <span className="input-unit">
                      <input type="number" min="0" step="0.5" inputMode="decimal" data-field="gst"
                        value={prices.pricing?.gstRate ?? 10} disabled={pricingLocked}
                        onChange={(e) => handlePricingChange('gstRate', e.target.value)} />
                      <span className="unit">%</span>
                    </span>
                  </label>
                  <label className="switch switch-field">
                    <input type="checkbox" checked={prices.pricing?.showGst !== false} disabled={pricingLocked}
                      onChange={(e) => handlePricingChange('showGst', e.target.checked)} data-field="show-gst" />
                    <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
                    <span>Add GST to quotes</span>
                  </label>
                </div>
              </section>

              {/* Business details for the customer PDF */}
              <Fold {...fold('business')} title="Your business" className="settings-group" summary={businessSummary}
                aside={<span className="save-state">Saved automatically</span>}>
                <label className="field">
                  <span className="field-label">Business name</span>
                  <input type="text" value={business.name} onChange={(e) => updateBusiness('name', e.target.value)} placeholder="Shown at the top of customer quotes" data-field="biz-name" />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">ABN</span>
                    <input type="text" value={business.abn} onChange={(e) => updateBusiness('abn', e.target.value)} placeholder="12 345 678 901" data-field="biz-abn" />
                  </label>
                  <label className="field">
                    <span className="field-label">Phone</span>
                    <input type="text" value={business.phone} onChange={(e) => updateBusiness('phone', e.target.value)} data-field="biz-phone" />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Email</span>
                    <input type="text" value={business.email} onChange={(e) => updateBusiness('email', e.target.value)} data-field="biz-email" />
                  </label>
                  <label className="field">
                    <span className="field-label">Quotes valid for</span>
                    <span className="input-unit">
                      <input type="number" min="1" step="1" value={business.validDays}
                        onChange={(e) => updateBusiness('validDays', e.target.value)} data-field="biz-valid" />
                      <span className="unit">days</span>
                    </span>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Address</span>
                  <input type="text" value={business.address} onChange={(e) => updateBusiness('address', e.target.value)} data-field="biz-address" />
                </label>
              </Fold>

              <div className="section-head timber-head">
                <h2>Timber and nails</h2>
              </div>
              <p className="hint">
                Timber is priced per metre of length. Unlock a price to change it, then save.
              </p>
              {prices.timberTypes.map(timberType => {
                const isExpanded = expandedGroups.has(timberType.id)
                const categoryLocked = isCategoryLocked(timberType.id)
                return (
                  <section key={timberType.id} className={`price-group ${isExpanded ? 'open' : ''}`}>
                    <div className="price-group-head">
                      <button type="button" className="price-group-toggle" onClick={() => toggleGroup(timberType.id)} aria-expanded={isExpanded}>
                        <span className="chevron" aria-hidden="true" />
                        {timberType.name}
                      </button>
                      <button type="button" className="text-btn" onClick={(e) => toggleCategoryLock(timberType.id, e)}>
                        {categoryLocked ? 'Unlock all' : 'Lock all'}
                      </button>
                    </div>
                    <Reveal open={isExpanded}>
                      <div className="price-table">
                        {[['Boards', 'board', timberType.boardSizes, 'pricePerBoard'], ['Bearers', 'bearer', timberType.bearerSizes, 'pricePerBearer']].map(([title, kind, sizes, key]) => (
                          <div key={kind} className="price-subgroup">
                            <h3>{title}</h3>
                            {sizes.map(size => {
                              const fieldId = `${timberType.id}-${kind}-${size.id}`
                              const isLocked = lockedFields.has(fieldId)
                              return (
                                <div key={size.id} className={`price-row ${isLocked ? 'locked' : ''}`}>
                                  <span className="price-size">{size.dimensions.replace('x', ' × ')}</span>
                                  <span className="price-input">
                                    <span className="unit-pre">$</span>
                                    <input
                                      type="number"
                                      value={size[key]}
                                      onChange={(e) => handlePriceChange(timberType.id, size.id, e.target.value, kind)}
                                      disabled={isLocked || !!ratesFromQuote}
                                      step="0.01"
                                      min="0"
                                      aria-label={`${timberType.name} ${size.dimensions} ${kind} price per metre`}
                                    />
                                    <span className="unit">/m</span>
                                  </span>
                                  <LockIcon isLocked={isLocked} onClick={() => toggleLock(fieldId)} label={`${size.dimensions} price`} />
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </Reveal>
                  </section>
                )
              })}

              <section className={`price-group ${expandedGroups.has('hardware') ? 'open' : ''}`}>
                <div className="price-group-head">
                  <button type="button" className="price-group-toggle" onClick={() => toggleGroup('hardware')} aria-expanded={expandedGroups.has('hardware')}>
                    <span className="chevron" aria-hidden="true" />
                    Hardware
                  </button>
                  <button type="button" className="text-btn" onClick={(e) => toggleCategoryLock('hardware', e)}>
                    {isCategoryLocked('hardware') ? 'Unlock all' : 'Lock all'}
                  </button>
                </div>
                <Reveal open={expandedGroups.has('hardware')}>
                  <div className="price-table">
                    <div className={`price-row ${lockedFields.has('nails') ? 'locked' : ''}`}>
                      <span className="price-size">Nails</span>
                      <span className="price-input">
                        <span className="unit-pre">$</span>
                        <input
                          type="number"
                          value={prices.nailPricePerNail ?? 0}
                          onChange={(e) => handleNailPriceChange(e.target.value)}
                          min="0"
                          disabled={lockedFields.has('nails') || !!ratesFromQuote}
                          step="0.01"
                          aria-label="Nail price each"
                        />
                        <span className="unit">each</span>
                      </span>
                      <LockIcon isLocked={lockedFields.has('nails')} onClick={() => toggleLock('nails')} label="nail price" />
                    </div>
                  </div>
                </Reveal>
              </section>
            </div>
            <footer className="panel-footer">
              <span className="save-state" aria-live="polite">
                {saveFlash ? 'Prices saved' : pricesSaved ? 'All prices saved' : 'Unsaved changes'}
              </span>
              <button type="button" onClick={handleSavePrices} className="btn btn-primary" disabled={(pricesSaved && !saveFlash) || !!ratesFromQuote}>
                Save prices
              </button>
            </footer>
          </>
        )}
      </aside>

      {/* Right - 3D pallet */}
      <main className="stage">
        {isPanelCollapsed && (
          <button type="button" className="show-panel-btn" onClick={() => setIsPanelCollapsed(false)}>
            <Icon name="panel" /> Show panel
          </button>
        )}

        <div className={`stamp ${liveQuote.isComplete ? 'complete' : ''} ${liveQuote.hasAnyPrice ? '' : 'empty'}`}>
          <span className="stamp-label">{liveQuote.hasAnyPrice ? totalLabel : 'No price yet'}</span>
          <span className="stamp-value"><Money value={(liveQuote.totalPrice || 0) * quantity} /></span>
          {missingText && <p className="stamp-missing" data-missing>Still to choose: {missingText}</p>}
          <div className="stamp-qty">
            <span id="stage-qty-label">Pallets</span>
            <Stepper id="stage-qty-label" label="pallets" value={palletQuantity} min={1} max={9999}
              onChange={(v) => setPalletQuantity(v)} />
          </div>
        </div>

        <Pallet3DLive previewData={livePreviewData} dark={isDarkMode} />

        {!(livePreviewData.numberOfTopBoards || livePreviewData.numberOfBottomBoards || livePreviewData.numberOfBearers) && (
          <div className="stage-empty">
            <p>Enter a size and choose some boards to see the pallet take shape.</p>
          </div>
        )}

        <div className="stage-controls">
          {selectedTopBoardSize ? (
          <label className="range">
            <span>Top boards <strong>{displayedTopBoards || 0}{maxTopBoardsAllowed > 0 && maxTopBoardsAllowed < 15 ? ` of ${maxTopBoardsAllowed}` : ''}</strong></span>
            <input
              type="range"
              min="1"
              max={maxTopBoardsForUI}
              step="1"
              value={parseInt(displayedTopBoards) || 1}
              onChange={(e) => setNumberOfTopBoards(e.target.value)}
            />
          </label>
          ) : <span />}
          <span className="stage-hint">Drag to turn, scroll or pinch to zoom</span>
        </div>
      </main>

      {/* Printable Quote - only visible when printing */}
      <PrintableQuote quoteData={liveQuote} quantity={quantity} variant={printVariant} quoteRef={quoteRef}
        totals={totals} business={business} customer={{ name: customerName.trim(), ref: customerRef.trim() }} />
    </div>
  )
}

export default PalletBuilderOverlay
