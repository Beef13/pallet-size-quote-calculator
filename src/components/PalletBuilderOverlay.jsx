import { useState, useEffect, useMemo } from 'react'
import timberData from '../data/timber-prices.json'
import { calculateTotalPrice, deckGapSize, maxDeckBoards, timberCost, formatCurrency, formatDimension } from '../utils/calculations'
import Pallet3DLive from './Pallet3DLive'
import LockIcon from './LockIcon'
import PrintableQuote from './PrintableQuote'
import '../styles/PalletBuilderOverlay.css'

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

// Edit Icon SVG component
function EditIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function PalletBuilderOverlay({ onQuoteCalculated, quoteData }) {
  // Panel collapsed state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return readStorage('palletDarkMode') === 'true'
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
  const [palletQuantity, setPalletQuantity] = useState('')
  
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
    setPalletQuantity('')
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

  return (
    <div className={`builder-layout ${isPanelCollapsed ? 'panel-collapsed' : ''}`}>
      {/* Collapsed Edit Button */}
      {isPanelCollapsed && (
        <button 
          className="expand-panel-btn"
          onClick={() => setIsPanelCollapsed(false)}
          title="Open Editor"
        >
          <EditIcon />
        </button>
      )}

      {/* Left Panel - Form Card */}
      <div className={`form-panel ${isPanelCollapsed ? 'hidden' : ''}`}>
        <div className="form-card">
          {/* Collapse Button */}
          <button 
            className="collapse-panel-btn"
            onClick={() => setIsPanelCollapsed(true)}
            title="Collapse Panel"
          >
            ✕
          </button>
          
          {/* Tab Navigation */}
          <div className="card-tabs">
            <button 
              className={`card-tab ${activeTab === 'calculator' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculator')}
            >
              Builder
            </button>
            <button 
              className={`card-tab ${activeTab === 'quote' ? 'active' : ''} ${liveQuote?.isComplete ? 'has-quote' : ''}`}
              onClick={() => setActiveTab('quote')}
            >
              Quote {liveQuote?.hasAnyPrice && <span className={`quote-ready-dot ${liveQuote.isComplete ? '' : 'partial'}`}>●</span>}
            </button>
            <button 
              className={`card-tab ${activeTab === 'prices' ? 'active' : ''}`}
              onClick={() => setActiveTab('prices')}
            >
              Prices
            </button>
          </div>

          {activeTab === 'calculator' ? (
            <>
              <div className="card-content">
              
                <div className="quote-form">
                  {/* Pallet Dimensions Section */}
                  <div className="section-heading">
                    <span className="section-title">Pallet Dimensions</span>
                  </div>
                  <div className="form-row three-col">
                    <div className="form-field">
                      <label>Load Preset</label>
                      <select
                        onChange={(e) => {
                          const value = e.target.value
                          if (value.startsWith('saved:')) {
                            const presetId = value.replace('saved:', '')
                            const preset = savedPresets.find(p => p.id === presetId)
                            if (preset) loadPreset(preset)
                          } else if (value) {
                            const [w, l] = value.split('x')
                            setPalletWidth(w)
                            setPalletLength(l)
                          }
                        }}
                        value=""
                      >
                        <option value="">Select...</option>
                        <optgroup label="Standard Sizes">
                          <option value="1165x1165">1165 × 1165mm</option>
                          <option value="1140x1140">1140 × 1140mm</option>
                        </optgroup>
                        {savedPresets.length > 0 && (
                          <optgroup label="My Saved Presets">
                            {savedPresets.map(preset => (
                              <option key={preset.id} value={`saved:${preset.id}`}>
                                {preset.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Width (mm)</label>
                      <input
                        type="number"
                        value={palletWidth}
                        onChange={(e) => setPalletWidth(e.target.value)}
                        placeholder="e.g., 1200"
                      />
                    </div>
                    <div className="form-field">
                      <label>Length (mm)</label>
                      <input
                        type="number"
                        value={palletLength}
                        onChange={(e) => setPalletLength(e.target.value)}
                        placeholder="e.g., 1200"
                      />
                    </div>
                  </div>

                  <div className="section-divider" />

                  {/* Bottom Boards Section */}
                  <div className="section-heading">
                    <span className="section-title">Bottom Boards</span>
                  </div>
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Timber</label>
                      <select
                        value={selectedBottomBoardType}
                        onChange={(e) => changeBottomBoardType(e.target.value)}
                      >
                        <option value="">Select type...</option>
                        {timberData.timberTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Size</label>
                      <select
                        value={selectedBottomBoardSize}
                        onChange={(e) => setSelectedBottomBoardSize(e.target.value)}
                        disabled={!selectedBottomBoardType}
                      >
                        <option value="">Select size...</option>
                        {availableBottomBoardSizes.map(size => (
                          <option key={size.id} value={size.id}>{size.dimensions}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Number of Boards {maxBottomBoardsAllowed > 0 && maxBottomBoardsAllowed < 15 && <span className="max-hint">(max {maxBottomBoardsAllowed})</span>}</label>
                    <select
                      value={displayedBottomBoards}
                      onChange={(e) => setNumberOfBottomBoards(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {[...Array(maxBottomBoardsForUI)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Custom Leader Boards Option (Bottom) */}
                  <div className="form-field checkbox-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={useCustomBottomLeaders}
                        onChange={(e) => setUseCustomBottomLeaders(e.target.checked)}
                      />
                      <span>Custom Leader Boards</span>
                    </label>
                  </div>
                  
                  {useCustomBottomLeaders && (
                    <div className="leader-board-options">
                      <div className="form-row two-col">
                        <div className="form-field">
                          <label>Timber</label>
                          <select
                            value={selectedBottomLeaderType}
                            onChange={(e) => changeBottomLeaderType(e.target.value)}
                          >
                            <option value="">Select type...</option>
                            {timberData.timberTypes.map(type => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Size</label>
                          <select
                            value={selectedBottomLeaderSize}
                            onChange={(e) => setSelectedBottomLeaderSize(e.target.value)}
                            disabled={!selectedBottomLeaderType}
                          >
                            <option value="">Select size...</option>
                            {availableBottomLeaderSizes.map(size => (
                              <option key={size.id} value={size.id}>{size.dimensions}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="section-divider" />

                  {/* Top Boards Section */}
                  <div className="section-heading">
                    <span className="section-title">Top Boards</span>
                  </div>
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Timber</label>
                      <select
                        value={selectedTopBoardType}
                        onChange={(e) => changeTopBoardType(e.target.value)}
                      >
                        <option value="">Select type...</option>
                        {timberData.timberTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Size</label>
                      <select
                        value={selectedTopBoardSize}
                        onChange={(e) => setSelectedTopBoardSize(e.target.value)}
                        disabled={!selectedTopBoardType}
                      >
                        <option value="">Select size...</option>
                        {availableTopBoardSizes.map(size => (
                          <option key={size.id} value={size.id}>{size.dimensions}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Number of Boards {maxTopBoardsAllowed > 0 && maxTopBoardsAllowed < 15 && <span className="max-hint">(max {maxTopBoardsAllowed})</span>}</label>
                    <select
                      value={displayedTopBoards}
                      onChange={(e) => setNumberOfTopBoards(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {[...Array(maxTopBoardsForUI)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Custom Leader Boards Option (Top) */}
                  <div className="form-field checkbox-field">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={useCustomTopLeaders}
                        onChange={(e) => setUseCustomTopLeaders(e.target.checked)}
                      />
                      <span>Custom Leader Boards</span>
                    </label>
                  </div>
                  
                  {useCustomTopLeaders && (
                    <div className="leader-board-options">
                      <div className="form-row two-col">
                        <div className="form-field">
                          <label>Timber</label>
                          <select
                            value={selectedTopLeaderType}
                            onChange={(e) => changeTopLeaderType(e.target.value)}
                          >
                            <option value="">Select type...</option>
                            {timberData.timberTypes.map(type => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Size</label>
                          <select
                            value={selectedTopLeaderSize}
                            onChange={(e) => setSelectedTopLeaderSize(e.target.value)}
                            disabled={!selectedTopLeaderType}
                          >
                            <option value="">Select size...</option>
                            {availableTopLeaderSizes.map(size => (
                              <option key={size.id} value={size.id}>{size.dimensions}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="section-divider" />

                  {/* Bearers Section */}
                  <div className="section-heading">
                    <span className="section-title">Bearers</span>
                  </div>
                  <div className="form-field">
                    <label>Timber</label>
                    <select
                      value={selectedBearerType}
                      onChange={(e) => changeBearerType(e.target.value)}
                    >
                      <option value="">Select timber type...</option>
                      {timberData.timberTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bearer Size and Number - Two Column */}
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Size</label>
                      <select
                        value={selectedBearerSize}
                        onChange={(e) => setSelectedBearerSize(e.target.value)}
                        disabled={!selectedBearerType}
                      >
                        <option value="">Select bearer size...</option>
                        {availableBearerSizes.map(size => (
                          <option key={size.id} value={size.id}>{size.dimensions}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Number of Bearers {maxBearersAllowed > 0 && maxBearersAllowed < 15 && <span className="max-hint">(max {maxBearersAllowed})</span>}</label>
                      <select
                        value={displayedBearers}
                        onChange={(e) => setNumberOfBearers(e.target.value)}
                      >
                        <option value="">Select...</option>
                        {[...Array(maxBearersForUI)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && <div className="error-msg">{error}</div>}
                  {layoutWarnings.map(w => <div key={w} className="error-msg">{w}</div>)}

                  <div className="section-divider" />

                  <div className="form-actions">
                    <button type="button" onClick={handleClear} className="btn-clear">Clear All</button>
                    <button type="button" onClick={() => setShowSavePresetModal(true)} className="btn-save-preset">Save Preset</button>
                  </div>
                  
                  <div className="preset-actions">
                    <button type="button" onClick={exportPresets} className="btn-export">
                      ↓ Export
                    </button>
                    <label className="btn-import">
                      ↑ Import
                      <input type="file" accept=".json" onChange={importPresets} hidden />
                    </label>
                  </div>
                  
                  {/* Saved Presets List */}
                  {savedPresets.length > 0 && (
                    <div className="saved-presets-section">
                      <div className="saved-presets-header">
                        <span>Saved Presets ({savedPresets.length})</span>
                      </div>
                      <div className="saved-presets-list">
                        {savedPresets.map(preset => (
                          <div key={preset.id} className="saved-preset-item">
                            <span className="preset-name">{preset.name}</span>
                            <span className="preset-size">{preset.palletWidth}×{preset.palletLength}</span>
                            <button 
                              className="preset-delete-btn"
                              onClick={() => deletePreset(preset.id)}
                              title="Delete preset"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
              
              {/* Save Preset Modal */}
              {showSavePresetModal && (
                <div className="modal-overlay" onClick={() => setShowSavePresetModal(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h3>Save Preset</h3>
                    <p>Save current configuration as a preset:</p>
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Enter preset name..."
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                    />
                    <div className="modal-actions">
                      <button onClick={() => setShowSavePresetModal(false)} className="btn-cancel">Cancel</button>
                      <button onClick={savePreset} className="btn-save" disabled={!newPresetName.trim()}>Save</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'quote' ? (
            <>
              <div className="card-content">
                {liveQuote?.hasAnyPrice ? (
                  <div className="quote-results">
                    <div className="quote-header">
                      <h3>Quote Summary</h3>
                      <span className={`quote-status ${liveQuote.isComplete ? 'ready' : 'partial'}`}>
                        {liveQuote.isComplete ? 'Complete' : 'In Progress'}
                      </span>
                    </div>
                    
                    <div className="result-grid">
                      {(liveQuote.palletWidth > 0 || liveQuote.palletLength > 0) && (
                        <div className="result-row">
                          <span>Pallet Size</span>
                          <span>{liveQuote.palletWidth || '—'} × {liveQuote.palletLength || '—'} mm</span>
                        </div>
                      )}
                      {/* Top Leader Boards (if custom leaders enabled) */}
                      {liveQuote.topLeaderCount > 0 && (
                        <div className="result-row leader-row">
                          <span>Top Leaders ({liveQuote.topLeaderCount}× {liveQuote.topLeaderSize || '—'} @ {formatDimension(liveQuote.boardLength)})</span>
                          <span>{formatCurrency(liveQuote.topLeadersTotal)}</span>
                        </div>
                      )}
                      {/* Top Inner Boards */}
                      {liveQuote.topBoardSize && liveQuote.topInnerBoards > 0 && (
                        <div className="result-row">
                          <span>Top Boards ({liveQuote.topInnerBoards}× {liveQuote.topBoardSize} @ {formatDimension(liveQuote.boardLength)})</span>
                          <span>{formatCurrency(liveQuote.topBoardsTotal)}</span>
                        </div>
                      )}
                      {/* Bottom Leader Boards (if custom leaders enabled) */}
                      {liveQuote.bottomLeaderCount > 0 && (
                        <div className="result-row leader-row">
                          <span>Bottom Leaders ({liveQuote.bottomLeaderCount}× {liveQuote.bottomLeaderSize || '—'} @ {formatDimension(liveQuote.boardLength)})</span>
                          <span>{formatCurrency(liveQuote.bottomLeadersTotal)}</span>
                        </div>
                      )}
                      {/* Bottom Inner Boards */}
                      {liveQuote.bottomBoardSize && liveQuote.bottomInnerBoards > 0 && (
                        <div className="result-row">
                          <span>Bottom Boards ({liveQuote.bottomInnerBoards}× {liveQuote.bottomBoardSize} @ {formatDimension(liveQuote.boardLength)})</span>
                          <span>{formatCurrency(liveQuote.bottomBoardsTotal)}</span>
                        </div>
                      )}
                      {liveQuote.bearerSize && liveQuote.numberOfBearers > 0 && (
                        <div className="result-row">
                          <span>Bearers ({liveQuote.numberOfBearers}× {liveQuote.bearerSize} @ {formatDimension(liveQuote.bearerLength)})</span>
                          <span>{formatCurrency(liveQuote.bearersTotal)}</span>
                        </div>
                      )}
                      {liveQuote.totalNails > 0 && (
                        <div className="result-row">
                          <span>Nails ({liveQuote.totalNails})</span>
                          <span>{formatCurrency(liveQuote.nailsTotal)}</span>
                        </div>
                      )}
                      
                      {(liveQuote.topGapSize > 0 || liveQuote.bottomGapSize > 0) && (
                        <div className="section-divider" />
                      )}
                      {liveQuote.topGapSize > 0 && (
                        <div className="result-row highlight">
                          <span>Top Gap</span>
                          <span>{formatDimension(liveQuote.topGapSize)}</span>
                        </div>
                      )}
                      {liveQuote.bottomGapSize > 0 && (
                        <div className="result-row highlight">
                          <span>Bottom Gap</span>
                          <span>{formatDimension(liveQuote.bottomGapSize)}</span>
                        </div>
                      )}
                      {layoutWarnings.map(w => <div key={w} className="error-msg">{w}</div>)}
                      {liveQuote.palletLength <= 0 && (
                        <div className="error-msg">Enter the pallet length - timber is priced per metre.</div>
                      )}
                    </div>

                    <div className={`subtotal-row ${!liveQuote.isComplete ? 'partial' : ''}`}>
                      <span>{liveQuote.isComplete ? 'Subtotal (1 Pallet)' : 'Running Total'}</span>
                      <span>{formatCurrency(liveQuote.totalPrice)}</span>
                    </div>

                    <div className="quantity-row">
                      <label>Number of Pallets</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={palletQuantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        onBlur={handleQuantityBlur}
                        placeholder="e.g, 1"
                        className="quantity-input"
                      />
                    </div>

                    <div className={`total-row ${!liveQuote.isComplete ? 'partial' : ''}`}>
                      <span>Total ({quantity} Pallet{quantity > 1 ? 's' : ''})</span>
                      <span>{formatCurrency(liveQuote.totalPrice * quantity)}</span>
                    </div>

                    <div className="form-actions">
                      <button onClick={() => window.print()} className="btn-calculate">Print Quote</button>
                      <button onClick={handleClear} className="btn-clear">New Quote</button>
                    </div>
                  </div>
                ) : (
                  <div className="quote-empty">
                    <div className="quote-empty-icon">📋</div>
                    <h3>No Quote Yet</h3>
                    <p>Fill in all fields in the Builder tab to see your quote calculated in real-time.</p>
                    <button onClick={() => setActiveTab('calculator')} className="btn-calculate">
                      Go to Builder
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="card-content price-editor-content">
              
              <div className="price-header">
                <span className="price-header-label">Size</span>
                <span className="price-header-currency">$/metre</span>
              </div>
              
              <div className="price-editor-scroll">
                {prices.timberTypes.map(timberType => {
                  const isExpanded = expandedGroups.has(timberType.id)
                  const categoryLocked = isCategoryLocked(timberType.id)
                  return (
                    <div key={timberType.id} className={`price-group ${isExpanded ? 'expanded' : 'collapsed'}`}>
                      <div className="price-group-header">
                        <button className="price-group-toggle" onClick={() => toggleGroup(timberType.id)}>
                          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
                          <span className="toggle-title">{timberType.name}</span>
                        </button>
                        <div className="master-lock" onClick={(e) => toggleCategoryLock(timberType.id, e)}>
                          <span className="master-lock-label">ALL</span>
                          <LockIcon isLocked={categoryLocked} onClick={(e) => toggleCategoryLock(timberType.id, e)} />
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="price-group-content">
                          <div className="price-subgroup">
                            <span className="subgroup-label">Boards (per metre)</span>
                            {timberType.boardSizes.map(size => {
                              const fieldId = `${timberType.id}-board-${size.id}`
                              const isLocked = lockedFields.has(fieldId)
                              return (
                                <div key={size.id} className="price-item">
                                  <span>{size.dimensions}</span>
                                  <div className="price-input-wrap">
                                    <span className="price-prefix">$</span>
                                    <input
                                      type="number"
                                      value={size.pricePerBoard}
                                      onChange={(e) => handlePriceChange(timberType.id, size.id, e.target.value, 'board')}
                                      disabled={isLocked}
                                      step="0.01"
                                    />
                                    <LockIcon isLocked={isLocked} onClick={() => toggleLock(fieldId)} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="price-subgroup">
                            <span className="subgroup-label">Bearers (per metre)</span>
                            {timberType.bearerSizes.map(size => {
                              const fieldId = `${timberType.id}-bearer-${size.id}`
                              const isLocked = lockedFields.has(fieldId)
                              return (
                                <div key={size.id} className="price-item">
                                  <span>{size.dimensions}</span>
                                  <div className="price-input-wrap">
                                    <span className="price-prefix">$</span>
                                    <input
                                      type="number"
                                      value={size.pricePerBearer}
                                      onChange={(e) => handlePriceChange(timberType.id, size.id, e.target.value, 'bearer')}
                                      disabled={isLocked}
                                      step="0.01"
                                    />
                                    <LockIcon isLocked={isLocked} onClick={() => toggleLock(fieldId)} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                
                <div className={`price-group ${expandedGroups.has('hardware') ? 'expanded' : 'collapsed'}`}>
                  <div className="price-group-header">
                    <button className="price-group-toggle" onClick={() => toggleGroup('hardware')}>
                      <span className="toggle-icon">{expandedGroups.has('hardware') ? '▼' : '▶'}</span>
                      <span className="toggle-title">Hardware</span>
                    </button>
                    <div className="master-lock" onClick={(e) => toggleCategoryLock('hardware', e)}>
                      <span className="master-lock-label">ALL</span>
                      <LockIcon isLocked={isCategoryLocked('hardware')} onClick={(e) => toggleCategoryLock('hardware', e)} />
                    </div>
                  </div>
                  
                  {expandedGroups.has('hardware') && (
                    <div className="price-group-content">
                      <div className="price-item">
                        <span>Nail (per unit)</span>
                        <div className="price-input-wrap">
                          <input
                            type="number"
                            value={prices.nailPricePerNail ?? 0}
                            onChange={(e) => handleNailPriceChange(e.target.value)}
                            min="0"
                            disabled={lockedFields.has('nails')}
                            step="0.01"
                          />
                          <LockIcon isLocked={lockedFields.has('nails')} onClick={() => toggleLock('nails')} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="price-save-actions">
                <button onClick={handleSavePrices} className="btn-calculate">
                  {saveFlash ? 'Saved ✓' : pricesSaved ? 'Save Prices' : 'Save Prices •'}
                </button>
              </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel - 3D Pallet */}
      <div className="pallet-panel">
        {/* Live Price Header */}
        <div className="live-price-header">
          <div className="quantity-input-group">
            <label>Pallets</label>
            <input
              type="number"
              min="1"
              value={palletQuantity}
              step="1"
              inputMode="numeric"
              onChange={(e) => handleQuantityChange(e.target.value)}
              onBlur={handleQuantityBlur}
              placeholder="e.g, 1"
              className="quantity-input"
            />
          </div>
          <div className="live-price-display">
            {liveQuote?.hasAnyPrice ? (
              <>
                <span className="price-label">{liveQuote.isComplete ? 'Total' : 'Running'}</span>
                <span className={`price-value ${!liveQuote.isComplete ? 'partial' : ''}`}>
                  ${((liveQuote.totalPrice || 0) * quantity).toFixed(2)}
                </span>
              </>
            ) : (
              <span className="price-placeholder">$0.00</span>
            )}
          </div>
          
          {/* Dark Mode Toggle */}
          <button 
            className={`dark-mode-toggle ${isDarkMode ? 'active' : ''}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>

        <Pallet3DLive previewData={livePreviewData} />
        
        {/* Top Boards Slider */}
        <div className="dimension-sliders">
          <div className="slider-group">
            <label>
              <span className="slider-label">Top Boards</span>
              <span className="slider-value">{displayedTopBoards || 0}{maxTopBoardsAllowed > 0 && maxTopBoardsAllowed < 15 ? ` / ${maxTopBoardsAllowed}` : ''}</span>
            </label>
            <input
              type="range"
              min="1"
              max={maxTopBoardsForUI}
              step="1"
              value={parseInt(displayedTopBoards) || 1}
              onChange={(e) => setNumberOfTopBoards(e.target.value)}
              className="dimension-slider"
            />
          </div>
        </div>
        
        <div className="drag-hint">Drag to rotate • Scroll to zoom</div>
      </div>

      {/* Printable Quote - only visible when printing */}
      <PrintableQuote quoteData={liveQuote} quantity={quantity} />
    </div>
  )
}

export default PalletBuilderOverlay
