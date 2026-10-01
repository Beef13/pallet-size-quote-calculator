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

// Merge saved/imported price values onto the current timber data structure,
// so old or partial price files can never remove timber types or sizes.
function mergePrices(saved) {
  const merged = JSON.parse(JSON.stringify(timberData))
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
    <div className="stepper" role="group" aria-labelledby={id}>
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

// Section heading that also shows what that part of the pallet costs
function SectionHead({ title, cost }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {cost > 0 && <span className="section-cost">{formatCurrency(cost)}</span>}
    </div>
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
  
  // Price editor state
  const [prices, setPrices] = useState({ timberTypes: [] })
  const [lockedFields, setLockedFields] = useState(new Set())
  const [expandedGroups, setExpandedGroups] = useState(new Set(['pine-green-case'])) // First group expanded by default
  
  // Saved presets state
  const [savedPresets, setSavedPresets] = useState([])
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [pricesSaved, setPricesSaved] = useState(true)
  const [saveFlash, setSaveFlash] = useState(false)

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
    const dataToExport = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      presets: savedPresets,
      prices: prices
    }
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pallet-presets-${new Date().toISOString().split('T')[0]}.json`
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

    const runningTotal = Math.round(
      (top.leadersTotal + top.innerTotal + bottom.leadersTotal + bottom.innerTotal + bearersTotal + nailsTotal) * 100
    ) / 100

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
      totalPrice: runningTotal,
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
      hasAnyPrice: runningTotal > 0 || totalNails > 0
    }
  }, [palletWidth, palletLength, displayedTopBoards, displayedBottomBoards, displayedBearers, selectedTopBoardType, selectedTopBoardSize, selectedBottomBoardType, selectedBottomBoardSize, selectedBearerType, selectedBearerSize, prices, useCustomTopLeaders, selectedTopLeaderType, selectedTopLeaderSize, useCustomBottomLeaders, selectedBottomLeaderType, selectedBottomLeaderSize])

  // Warnings shown under the form
  const layoutWarnings = []
  if (!liveQuote.topFits) layoutWarnings.push("Top boards don't fit across the pallet width - reduce the number of boards or use narrower leader boards.")
  if (!liveQuote.bottomFits) layoutWarnings.push("Bottom boards don't fit across the pallet width - reduce the number of boards or use narrower leader boards.")

  // PDF export: 'customer' (spec + total) or 'breakdown' (internal costs).
  // Renders the chosen layout, names the file, then opens the print dialog
  // where "Save as PDF" can be chosen.
  const [printVariant, setPrintVariant] = useState('customer')
  const [quoteRef, setQuoteRef] = useState('')
  const exportPdf = (variant) => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const ref = `Q${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
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
    onQuoteCalculated(null)
  }

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
  const quantity = Math.max(1, parseInt(palletQuantity) || 1)

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
      <section className="form-section" aria-label={isTop ? 'Top boards' : 'Bottom boards'}>
        <SectionHead title={isTop ? 'Top boards' : 'Bottom boards'} cost={sectionCosts[deck]} />
        <div className="field-row">
          <label className="field">
            <span className="field-label">Timber</span>
            <select value={p.type} onChange={(e) => p.setType(e.target.value)} data-field={`${deck}-type`}>
              <option value="">Choose timber</option>
              {timberOptions}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Size</span>
            <select value={p.size} onChange={(e) => p.setSize(e.target.value)} disabled={!p.type} data-field={`${deck}-size`}>
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
              <select value={p.leaderType} onChange={(e) => p.setLeaderType(e.target.value)} data-field={`${deck}-leader-type`}>
                <option value="">Choose timber</option>
                {timberOptions}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Leader size</span>
              <select value={p.leaderSize} onChange={(e) => p.setLeaderSize(e.target.value)} disabled={!p.leaderType} data-field={`${deck}-leader-size`}>
                <option value="">{p.leaderType ? 'Choose size' : 'Choose timber first'}</option>
                {sizeOptions(p.leaderSizes)}
              </select>
            </label>
          </div>
        )}
      </section>
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

  const totalLabel = liveQuote.isComplete ? (quantity > 1 ? `Total for ${quantity} pallets` : 'Total') : 'Running total'

  const tabs = [
    { id: 'calculator', label: 'Build' },
    { id: 'quote', label: 'Quote' },
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
              <section className="form-section" aria-label="Pallet size">
                <SectionHead title="Pallet size" />
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
                      <input type="number" inputMode="numeric" min="0" value={palletWidth} data-field="width"
                        onChange={(e) => setPalletWidth(e.target.value)} placeholder="1165" />
                      <span className="unit">mm</span>
                    </span>
                  </label>
                  <label className="field">
                    <span className="field-label">Length</span>
                    <span className="input-unit">
                      <input type="number" inputMode="numeric" min="0" value={palletLength} data-field="length"
                        onChange={(e) => setPalletLength(e.target.value)} placeholder="1165" />
                      <span className="unit">mm</span>
                    </span>
                  </label>
                </div>
                <p className="hint">Boards run the length of the pallet. Bearers run across the width.</p>
              </section>

              {renderDeck('bottom')}
              {renderDeck('top')}

              <section className="form-section" aria-label="Bearers">
                <SectionHead title="Bearers" cost={sectionCosts.bearers} />
                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Timber</span>
                    <select value={selectedBearerType} onChange={(e) => changeBearerType(e.target.value)} data-field="bearer-type">
                      <option value="">Choose timber</option>
                      {timberOptions}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Size</span>
                    <select value={selectedBearerSize} onChange={(e) => setSelectedBearerSize(e.target.value)} disabled={!selectedBearerType} data-field="bearer-size">
                      <option value="">{selectedBearerType ? 'Choose size' : 'Choose timber first'}</option>
                      {sizeOptions(availableBearerSizes)}
                    </select>
                  </label>
                </div>
                <div className="field field-inline">
                  <span className="field-label" id="bearer-count-label">Bearers {maxNote(maxBearersAllowed)}</span>
                  <Stepper id="bearer-count-label" label="bearers" value={displayedBearers} onChange={setNumberOfBearers} max={maxBearersForUI} allowEmpty />
                </div>
              </section>

              {(error || layoutWarnings.length > 0) && (
                <div className="notice" role="alert">
                  {error && <p>{error}</p>}
                  {layoutWarnings.map(w => <p key={w}>{w}</p>)}
                </div>
              )}

              <section className="form-section presets" aria-label="Saved presets">
                <div className="section-head">
                  <h2>Saved presets</h2>
                  <div className="text-actions">
                    <button type="button" className="text-btn" onClick={exportPresets}>Export</button>
                    <label className="text-btn">
                      Import
                      <input type="file" accept=".json,application/json" onChange={importPresets} hidden />
                    </label>
                  </div>
                </div>
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
              </section>
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
                  <div className="quote-meta">
                    <div>
                      <h2>{liveQuote.palletWidth && liveQuote.palletLength
                        ? `${liveQuote.palletWidth} × ${liveQuote.palletLength} mm pallet`
                        : 'Pallet'}</h2>
                      <p className="hint">
                        {liveQuote.isComplete ? 'Ready to export as a customer PDF or a cost breakdown.' : 'Still missing some parts, so this is a running total.'}
                      </p>
                    </div>
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

                  <div className="totals">
                    <div className="totals-row">
                      <span>Per pallet</span>
                      <span>{formatCurrency(liveQuote.totalPrice)}</span>
                    </div>
                    <div className="totals-row">
                      <span id="quote-qty-label">Pallets</span>
                      <Stepper id="quote-qty-label" label="pallets" value={palletQuantity} min={1} max={9999}
                        onChange={(v) => setPalletQuantity(v)} />
                    </div>
                    <div className={`totals-row grand ${liveQuote.isComplete ? '' : 'partial'}`}>
                      <span>{liveQuote.isComplete ? 'Total' : 'Running total'}</span>
                      <span><Money value={liveQuote.totalPrice * quantity} /></span>
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

        {activeTab === 'prices' && (
          <>
            <div className="panel-body prices">
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
                    {isExpanded && (
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
                                      disabled={isLocked}
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
                    )}
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
                {expandedGroups.has('hardware') && (
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
                          disabled={lockedFields.has('nails')}
                          step="0.01"
                          aria-label="Nail price each"
                        />
                        <span className="unit">each</span>
                      </span>
                      <LockIcon isLocked={lockedFields.has('nails')} onClick={() => toggleLock('nails')} label="nail price" />
                    </div>
                  </div>
                )}
              </section>
            </div>
            <footer className="panel-footer">
              <span className="save-state" aria-live="polite">
                {saveFlash ? 'Prices saved' : pricesSaved ? 'All prices saved' : 'Unsaved changes'}
              </span>
              <button type="button" onClick={handleSavePrices} className="btn btn-primary" disabled={pricesSaved && !saveFlash}>
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
      <PrintableQuote quoteData={liveQuote} quantity={quantity} variant={printVariant} quoteRef={quoteRef} />
    </div>
  )
}

export default PalletBuilderOverlay
