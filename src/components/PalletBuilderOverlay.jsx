import { useState, useEffect, useMemo } from 'react'
import timberData from '../data/timber-prices.json'
import { calculateGapSize, calculateTotalPrice, validateInputs, formatCurrency, formatDimension } from '../utils/calculations'
import Pallet3DLive from './Pallet3DLive'
import LockIcon from './LockIcon'
import PrintableQuote from './PrintableQuote'
import '../styles/PalletBuilderOverlay.css'

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

  // Available sizes
  const [availableTopBoardSizes, setAvailableTopBoardSizes] = useState([])
  const [availableBottomBoardSizes, setAvailableBottomBoardSizes] = useState([])
  const [availableBearerSizes, setAvailableBearerSizes] = useState([])

  // Load prices - merge saved prices with current timber data structure
  useEffect(() => {
    const savedPrices = localStorage.getItem('timberPrices')
    
    // Always start with the current timber data structure
    let currentPrices = JSON.parse(JSON.stringify(timberData))
    
    // If we have saved prices, try to merge the price values
    if (savedPrices) {
      try {
        const saved = JSON.parse(savedPrices)
        // Only merge if the saved data has the same timber type IDs
        currentPrices.timberTypes.forEach(type => {
          const savedType = saved.timberTypes?.find(t => t.id === type.id)
          if (savedType) {
            type.boardSizes.forEach(size => {
              const savedSize = savedType.boardSizes?.find(s => s.id === size.id)
              if (savedSize?.pricePerBoard !== undefined) {
                size.pricePerBoard = savedSize.pricePerBoard
              }
            })
            type.bearerSizes.forEach(size => {
              const savedSize = savedType.bearerSizes?.find(s => s.id === size.id)
              if (savedSize?.pricePerBearer !== undefined) {
                size.pricePerBearer = savedSize.pricePerBearer
              }
            })
          }
        })
        if (saved.nailPricePerNail !== undefined) {
          currentPrices.nailPricePerNail = saved.nailPricePerNail
        }
      } catch (e) {
        console.log('Could not merge saved prices, using defaults')
      }
    }
    
    setPrices(currentPrices)
    
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
    const saved = localStorage.getItem('palletPresets')
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved))
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
      selectedBearerType,
      selectedBearerSize,
      numberOfBearers
    }
    
    const updatedPresets = [...savedPresets, preset]
    setSavedPresets(updatedPresets)
    localStorage.setItem('palletPresets', JSON.stringify(updatedPresets))
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
    setSelectedBearerType(preset.selectedBearerType || '')
    setSelectedBearerSize(preset.selectedBearerSize || '')
    setNumberOfBearers(preset.numberOfBearers || '')
  }

  // Delete a saved preset
  const deletePreset = (presetId) => {
    const updatedPresets = savedPresets.filter(p => p.id !== presetId)
    setSavedPresets(updatedPresets)
    localStorage.setItem('palletPresets', JSON.stringify(updatedPresets))
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
        if (data.presets && Array.isArray(data.presets)) {
          // Merge imported presets with existing (avoid duplicates by name)
          const existingNames = new Set(savedPresets.map(p => p.name))
          const newPresets = data.presets.filter(p => !existingNames.has(p.name))
          const mergedPresets = [...savedPresets, ...newPresets.map(p => ({ ...p, id: Date.now().toString() + Math.random() }))]
          setSavedPresets(mergedPresets)
          localStorage.setItem('palletPresets', JSON.stringify(mergedPresets))
        }
        if (data.prices) {
          setPrices(data.prices)
          localStorage.setItem('timberPrices', JSON.stringify(data.prices))
        }
        alert(`Imported ${data.presets?.length || 0} presets successfully!`)
      } catch (err) {
        alert('Error importing file. Please check the file format.')
      }
    }
    reader.readAsText(file)
    event.target.value = '' // Reset file input
  }

  useEffect(() => {
    if (selectedTopBoardType) {
      const type = timberData.timberTypes.find(t => t.id === selectedTopBoardType)
      setAvailableTopBoardSizes(type ? type.boardSizes : [])
      setSelectedTopBoardSize('')
    } else {
      setAvailableTopBoardSizes([])
    }
  }, [selectedTopBoardType])

  useEffect(() => {
    if (selectedBottomBoardType) {
      const type = timberData.timberTypes.find(t => t.id === selectedBottomBoardType)
      setAvailableBottomBoardSizes(type ? type.boardSizes : [])
      setSelectedBottomBoardSize('')
    } else {
      setAvailableBottomBoardSizes([])
    }
  }, [selectedBottomBoardType])

  useEffect(() => {
    if (selectedBearerType) {
      const type = timberData.timberTypes.find(t => t.id === selectedBearerType)
      setAvailableBearerSizes(type ? type.bearerSizes : [])
      setSelectedBearerSize('')
    } else {
      setAvailableBearerSizes([])
    }
  }, [selectedBearerType])

  // Get current top board width for calculations
  const currentTopBoardWidth = useMemo(() => {
    if (!selectedTopBoardType || !selectedTopBoardSize) return 0
    const type = timberData.timberTypes.find(t => t.id === selectedTopBoardType)
    const size = type?.boardSizes.find(s => s.id === selectedTopBoardSize)
    return size?.width || 0
  }, [selectedTopBoardType, selectedTopBoardSize])

  // Get current bottom board width for calculations
  const currentBottomBoardWidth = useMemo(() => {
    if (!selectedBottomBoardType || !selectedBottomBoardSize) return 0
    const type = timberData.timberTypes.find(t => t.id === selectedBottomBoardType)
    const size = type?.boardSizes.find(s => s.id === selectedBottomBoardSize)
    return size?.width || 0
  }, [selectedBottomBoardType, selectedBottomBoardSize])

  // Get current bearer thickness for calculations
  const currentBearerThickness = useMemo(() => {
    if (!selectedBearerType || !selectedBearerSize) return 0
    const type = timberData.timberTypes.find(t => t.id === selectedBearerType)
    const size = type?.bearerSizes.find(s => s.id === selectedBearerSize)
    return size?.thickness || 0
  }, [selectedBearerType, selectedBearerSize])

  // Calculate max boards that can fit without overlapping
  // Returns -1 when we shouldn't apply any limit (partial input or unreasonably small width)
  const maxTopBoardsAllowed = useMemo(() => {
    const width = parseFloat(palletWidth) || 0
    if (!currentTopBoardWidth) {
      return 15 // No board size selected, allow all
    }
    // Require minimum 2 boards worth of width to be considered "complete"
    const minReasonableWidth = currentTopBoardWidth * 2
    if (!width || width < minReasonableWidth) {
      return -1 // Invalid/partial width - don't limit
    }
    const maxBoards = Math.floor(width / currentTopBoardWidth)
    return Math.min(15, maxBoards) // Cap at 15
  }, [palletWidth, currentTopBoardWidth])

  const maxBottomBoardsAllowed = useMemo(() => {
    const width = parseFloat(palletWidth) || 0
    if (!currentBottomBoardWidth) {
      return 15 // No board size selected, allow all
    }
    const minReasonableWidth = currentBottomBoardWidth * 2
    if (!width || width < minReasonableWidth) {
      return -1 // Invalid/partial width - don't limit
    }
    const maxBoards = Math.floor(width / currentBottomBoardWidth)
    return Math.min(15, maxBoards) // Cap at 15
  }, [palletWidth, currentBottomBoardWidth])

  // For UI display - show 15 when not limiting
  const maxTopBoardsForUI = maxTopBoardsAllowed === -1 ? 15 : maxTopBoardsAllowed
  const maxBottomBoardsForUI = maxBottomBoardsAllowed === -1 ? 15 : maxBottomBoardsAllowed

  // Calculate max bearers that can fit without overlapping
  // Returns -1 when we shouldn't apply any limit (partial input or unreasonably small length)
  const maxBearersAllowed = useMemo(() => {
    const length = parseFloat(palletLength) || 0
    if (!currentBearerThickness) {
      return 15 // No bearer size selected, allow all
    }
    // Require minimum 2 bearers worth of length to be considered "complete"
    // This prevents adjustments during intermediate typing
    const minReasonableLength = currentBearerThickness * 2
    if (!length || length < minReasonableLength) {
      return -1 // Invalid/partial length - don't limit
    }
    
    const maxBearers = Math.floor(length / currentBearerThickness)
    return Math.min(15, maxBearers) // Cap at 15
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

    // Top board dimensions
    let topBoardWidth = 100
    let topBoardThickness = 22
    if (selectedTopBoardType && selectedTopBoardSize) {
      const type = timberData.timberTypes.find(t => t.id === selectedTopBoardType)
      const size = type?.boardSizes.find(s => s.id === selectedTopBoardSize)
      if (size) {
        topBoardWidth = size.width
        topBoardThickness = size.thickness
      }
    }

    // Bottom board dimensions
    let bottomBoardWidth = 100
    let bottomBoardThickness = 22
    if (selectedBottomBoardType && selectedBottomBoardSize) {
      const type = timberData.timberTypes.find(t => t.id === selectedBottomBoardType)
      const size = type?.boardSizes.find(s => s.id === selectedBottomBoardSize)
      if (size) {
        bottomBoardWidth = size.width
        bottomBoardThickness = size.thickness
      }
    }

    // Bearer dimensions
    let bearerWidth = 75
    let bearerHeight = 38
    if (selectedBearerType && selectedBearerSize) {
      const type = timberData.timberTypes.find(t => t.id === selectedBearerType)
      const size = type?.bearerSizes.find(s => s.id === selectedBearerSize)
      if (size) {
        bearerWidth = size.width
        bearerHeight = size.thickness
      }
    }

    const topGap = topBoards > 1 ? calculateGapSize(width, topBoardWidth, topBoards) : 0
    const bottomGap = bottomBoards > 1 ? calculateGapSize(width, bottomBoardWidth, bottomBoards) : 0

    return {
      palletWidth: width,
      palletLength: length,
      topBoardWidth: topBoardWidth,
      topBoardThickness: topBoardThickness,
      bottomBoardWidth: bottomBoardWidth,
      bottomBoardThickness: bottomBoardThickness,
      bearerWidth: bearerWidth,
      bearerHeight: bearerHeight,
      numberOfTopBoards: topBoards,
      numberOfBottomBoards: bottomBoards,
      numberOfBearers: bearers,
      topGapSize: Math.max(0, topGap),
      bottomGapSize: Math.max(0, bottomGap)
    }
  }, [palletWidth, palletLength, displayedTopBoards, displayedBottomBoards, displayedBearers, selectedTopBoardType, selectedTopBoardSize, selectedBottomBoardType, selectedBottomBoardSize, selectedBearerType, selectedBearerSize])

  // Real-time progressive quote calculation - updates as each element is added
  const liveQuote = useMemo(() => {
    const width = parseFloat(palletWidth) || 0
    const length = parseFloat(palletLength) || 0
    // Use capped values for quote calculation
    const topBoards = parseInt(displayedTopBoards) || 0
    const bottomBoards = parseInt(displayedBottomBoards) || 0
    const bearers = parseInt(displayedBearers) || 0

    // Get timber types and sizes for top boards
    const topBoardTimberType = prices.timberTypes.find(t => t.id === selectedTopBoardType)
    const topBoardSize = topBoardTimberType?.boardSizes.find(s => s.id === selectedTopBoardSize)
    
    // Get timber types and sizes for bottom boards
    const bottomBoardTimberType = prices.timberTypes.find(t => t.id === selectedBottomBoardType)
    const bottomBoardSize = bottomBoardTimberType?.boardSizes.find(s => s.id === selectedBottomBoardSize)
    
    // Get timber types and sizes for bearers
    const bearerTimberType = prices.timberTypes.find(t => t.id === selectedBearerType)
    const bearerSize = bearerTimberType?.bearerSizes.find(s => s.id === selectedBearerSize)

    // Progressive price calculation
    let runningTotal = 0
    let topBoardsTotal = 0
    let bottomBoardsTotal = 0
    let bearersTotal = 0
    let nailsTotal = 0
    let totalNails = 0
    let topGapSize = 0
    let bottomGapSize = 0

    // Calculate top boards price if we have board info
    if (topBoardSize && topBoards > 0) {
      topBoardsTotal = parseFloat(calculateTotalPrice(topBoardSize.pricePerBoard, topBoards))
      runningTotal += topBoardsTotal
      if (width > 0) {
        topGapSize = calculateGapSize(width, topBoardSize.width, topBoards)
      }
    }

    // Calculate bottom boards price if we have board info
    if (bottomBoardSize && bottomBoards > 0) {
      bottomBoardsTotal = parseFloat(calculateTotalPrice(bottomBoardSize.pricePerBoard, bottomBoards))
      runningTotal += bottomBoardsTotal
      if (width > 0) {
        bottomGapSize = calculateGapSize(width, bottomBoardSize.width, bottomBoards)
      }
    }

    // Calculate bearers price if we have bearer info
    if (bearerSize && bearers > 0) {
      bearersTotal = parseFloat(calculateTotalPrice(bearerSize.pricePerBearer, bearers))
      runningTotal += bearersTotal
    }

    // Calculate nails if we have both boards and bearers
    const nailPrice = prices.nailPricePerNail || 0.02
    if (topBoards > 0 && bearers > 0) {
      totalNails += topBoards * bearers * 2
    }
    if (bottomBoards > 0 && bearers > 0) {
      totalNails += bottomBoards * bearers * 2
    }
    if (totalNails > 0) {
      nailsTotal = parseFloat(calculateTotalPrice(nailPrice, totalNails))
      runningTotal += nailsTotal
    }

    // Check if quote is complete (all required fields filled)
    const isComplete = width > 0 && length > 0 && topBoards > 0 && bottomBoards > 0 && 
                       bearers > 0 && topBoardTimberType && bottomBoardTimberType && bearerTimberType && 
                       topBoardSize && bottomBoardSize && bearerSize

    // Return progressive quote data
    return {
      topBoardTimberType: topBoardTimberType?.name || '',
      bottomBoardTimberType: bottomBoardTimberType?.name || '',
      bearerTimberType: bearerTimberType?.name || '',
      topBoardSize: topBoardSize?.dimensions || '',
      bottomBoardSize: bottomBoardSize?.dimensions || '',
      bearerSize: bearerSize?.dimensions || '',
      numberOfTopBoards: topBoards,
      numberOfBearers: bearers,
      numberOfBottomBoards: bottomBoards,
      pricePerTopBoard: topBoardSize?.pricePerBoard || 0,
      pricePerBottomBoard: bottomBoardSize?.pricePerBoard || 0,
      pricePerBearer: bearerSize?.pricePerBearer || 0,
      topBoardsTotal,
      bearersTotal,
      bottomBoardsTotal,
      totalNails,
      pricePerNail: nailPrice,
      nailsTotal,
      totalPrice: runningTotal,
      palletWidth: width,
      palletLength: length,
      topBoardWidth: topBoardSize?.width || 0,
      bottomBoardWidth: bottomBoardSize?.width || 0,
      topGapSize,
      bottomGapSize,
      isComplete,
      hasAnyPrice: runningTotal > 0
    }
  }, [palletWidth, palletLength, displayedTopBoards, displayedBottomBoards, displayedBearers, selectedTopBoardType, selectedTopBoardSize, selectedBottomBoardType, selectedBottomBoardSize, selectedBearerType, selectedBearerSize, prices])

  const handleClear = () => {
    setPalletWidth('')
    setPalletLength('')
    setSelectedTopBoardType('')
    setSelectedTopBoardSize('')
    setSelectedBottomBoardType('')
    setSelectedBottomBoardSize('')
    setNumberOfTopBoards('')
    setNumberOfBottomBoards('')
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

  const handlePriceChange = (typeId, sizeId, newPrice, itemType) => {
    const updatedPrices = { ...prices }
    const typeIndex = updatedPrices.timberTypes.findIndex(t => t.id === typeId)
    
    if (itemType === 'board') {
      const sizeIndex = updatedPrices.timberTypes[typeIndex].boardSizes.findIndex(s => s.id === sizeId)
      updatedPrices.timberTypes[typeIndex].boardSizes[sizeIndex].pricePerBoard = parseFloat(newPrice) || 0
    } else {
      const sizeIndex = updatedPrices.timberTypes[typeIndex].bearerSizes.findIndex(s => s.id === sizeId)
      updatedPrices.timberTypes[typeIndex].bearerSizes[sizeIndex].pricePerBearer = parseFloat(newPrice) || 0
    }
    
    setPrices(updatedPrices)
  }

  const handleSavePrices = () => {
    localStorage.setItem('timberPrices', JSON.stringify(prices))
  }

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
                  {/* Pallet Dimensions */}
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
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Board Type (Bottom)</label>
                      <select
                        value={selectedBottomBoardType}
                        onChange={(e) => setSelectedBottomBoardType(e.target.value)}
                      >
                        <option value="">Select type...</option>
                        {timberData.timberTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Board Size (Bottom)</label>
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
                    <label>No. of Boards (Bottom) {maxBottomBoardsAllowed > 0 && maxBottomBoardsAllowed < 15 && <span className="max-hint">(max {maxBottomBoardsAllowed})</span>}</label>
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

                  <div className="section-divider" />

                  {/* Top Boards Section */}
                  <div className="form-row two-col">
                    <div className="form-field">
                      <label>Board Type (Top)</label>
                      <select
                        value={selectedTopBoardType}
                        onChange={(e) => setSelectedTopBoardType(e.target.value)}
                      >
                        <option value="">Select type...</option>
                        {timberData.timberTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Board Size (Top)</label>
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
                    <label>No. of Boards (Top) {maxTopBoardsAllowed > 0 && maxTopBoardsAllowed < 15 && <span className="max-hint">(max {maxTopBoardsAllowed})</span>}</label>
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

                  <div className="section-divider" />

                  {/* Bearer Timber Type - Full Width */}
                  <div className="form-field">
                    <label>Timber Type (Bearers)</label>
                    <select
                      value={selectedBearerType}
                      onChange={(e) => setSelectedBearerType(e.target.value)}
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
                      <label>Bearer Size</label>
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
                      <label>No. of Bearers {maxBearersAllowed > 0 && maxBearersAllowed < 15 && <span className="max-hint">(max {maxBearersAllowed})</span>}</label>
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
                      {liveQuote.topBoardsTotal > 0 && (
                        <div className="result-row">
                          <span>Top Boards ({liveQuote.numberOfTopBoards}× {liveQuote.topBoardSize || '—'})</span>
                          <span>{formatCurrency(liveQuote.topBoardsTotal)}</span>
                        </div>
                      )}
                      {liveQuote.bottomBoardsTotal > 0 && (
                        <div className="result-row">
                          <span>Bottom Boards ({liveQuote.numberOfBottomBoards}× {liveQuote.bottomBoardSize || '—'})</span>
                          <span>{formatCurrency(liveQuote.bottomBoardsTotal)}</span>
                        </div>
                      )}
                      {liveQuote.bearersTotal > 0 && (
                        <div className="result-row">
                          <span>Bearers ({liveQuote.numberOfBearers}× {liveQuote.bearerSize || '—'})</span>
                          <span>{formatCurrency(liveQuote.bearersTotal)}</span>
                        </div>
                      )}
                      {liveQuote.nailsTotal > 0 && (
                        <div className="result-row">
                          <span>Nails ({liveQuote.totalNails})</span>
                          <span>{formatCurrency(liveQuote.nailsTotal)}</span>
                        </div>
                      )}
                      
                      {liveQuote.topGapSize > 0 && (
                        <>
                          <div className="section-divider" />
                          <div className="result-row highlight">
                            <span>Top Gap</span>
                            <span>{formatDimension(liveQuote.topGapSize)}</span>
                          </div>
                        </>
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
                        value={palletQuantity}
                        onChange={(e) => setPalletQuantity(e.target.value)}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value)
                          if (!val || val < 1) setPalletQuantity('1')
                        }}
                        placeholder="1"
                        className="quantity-input"
                      />
                    </div>

                    <div className={`total-row ${!liveQuote.isComplete ? 'partial' : ''}`}>
                      <span>Total ({parseInt(palletQuantity) || 1} Pallet{(parseInt(palletQuantity) || 1) > 1 ? 's' : ''})</span>
                      <span>{formatCurrency(liveQuote.totalPrice * (parseInt(palletQuantity) || 1))}</span>
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
                            value={prices.nailPricePerNail || 0.02}
                            onChange={(e) => {
                              const updated = { ...prices }
                              updated.nailPricePerNail = parseFloat(e.target.value) || 0
                              setPrices(updated)
                            }}
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
                <button onClick={handleSavePrices} className="btn-calculate">Save Prices</button>
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
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d+$/.test(val)) {
                  setPalletQuantity(val)
                }
              }}
              onBlur={() => {
                if (palletQuantity === '' || parseInt(palletQuantity) < 1) {
                  setPalletQuantity('1')
                }
              }}
              placeholder="1"
              className="quantity-input"
            />
          </div>
          <div className="live-price-display">
            {liveQuote?.hasAnyPrice ? (
              <>
                <span className="price-label">{liveQuote.isComplete ? 'Total' : 'Running'}</span>
                <span className={`price-value ${!liveQuote.isComplete ? 'partial' : ''}`}>
                  ${((liveQuote.totalPrice || 0) * (parseInt(palletQuantity) || 1)).toFixed(2)}
                </span>
              </>
            ) : (
              <span className="price-placeholder">$0.00</span>
            )}
          </div>
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
      <PrintableQuote quoteData={liveQuote} quantity={parseInt(palletQuantity) || 1} />
    </div>
  )
}

export default PalletBuilderOverlay
