import { useState, useEffect, useMemo } from 'react'
import timberData from '../data/timber-prices.json'
import { calculateGapSize, calculateTotalPrice, validateInputs } from '../utils/calculations'
import Pallet3DLive from './Pallet3DLive'
import '../styles/PalletBuilder.css'

function PalletBuilder({ onQuoteCalculated }) {
  // Form state
  const [palletWidth, setPalletWidth] = useState('')
  const [palletLength, setPalletLength] = useState('')
  const [selectedBoardType, setSelectedBoardType] = useState('')
  const [selectedBoardSize, setSelectedBoardSize] = useState('')
  const [numberOfTopBoards, setNumberOfTopBoards] = useState('')
  const [numberOfBottomBoards, setNumberOfBottomBoards] = useState('')
  const [selectedBearerType, setSelectedBearerType] = useState('')
  const [selectedBearerSize, setSelectedBearerSize] = useState('')
  const [numberOfBearers, setNumberOfBearers] = useState('')
  const [error, setError] = useState('')

  // Available sizes based on timber type
  const [availableBoardSizes, setAvailableBoardSizes] = useState([])
  const [availableBearerSizes, setAvailableBearerSizes] = useState([])

  // Update board sizes when board timber type changes
  useEffect(() => {
    if (selectedBoardType) {
      const type = timberData.timberTypes.find(t => t.id === selectedBoardType)
      setAvailableBoardSizes(type ? type.boardSizes : [])
      setSelectedBoardSize('')
    } else {
      setAvailableBoardSizes([])
    }
  }, [selectedBoardType])

  // Update bearer sizes when bearer timber type changes
  useEffect(() => {
    if (selectedBearerType) {
      const type = timberData.timberTypes.find(t => t.id === selectedBearerType)
      setAvailableBearerSizes(type ? type.bearerSizes : [])
      setSelectedBearerSize('')
    } else {
      setAvailableBearerSizes([])
    }
  }, [selectedBearerType])

  // Live preview data - builds as user fills form
  const livePreviewData = useMemo(() => {
    const width = parseFloat(palletWidth) || 1200
    const length = parseFloat(palletLength) || 1000
    const topBoards = parseInt(numberOfTopBoards) || 0
    const bottomBoards = parseInt(numberOfBottomBoards) || 0
    const bearers = parseInt(numberOfBearers) || 0

    // Get board width from selection or default
    let boardWidth = 100
    if (selectedBoardType && selectedBoardSize) {
      const type = timberData.timberTypes.find(t => t.id === selectedBoardType)
      const size = type?.boardSizes.find(s => s.id === selectedBoardSize)
      if (size) boardWidth = size.width
    }

    // Calculate gaps
    const topGap = topBoards > 1 ? calculateGapSize(width, boardWidth, topBoards) : 0
    const bottomGap = bottomBoards > 1 ? calculateGapSize(width, boardWidth, bottomBoards) : 0

    return {
      palletWidth: width,
      palletLength: length,
      boardWidth: boardWidth,
      numberOfTopBoards: topBoards,
      numberOfBottomBoards: bottomBoards,
      numberOfBearers: bearers,
      topGapSize: topGap,
      bottomGapSize: bottomGap
    }
  }, [palletWidth, palletLength, numberOfTopBoards, numberOfBottomBoards, numberOfBearers, selectedBoardType, selectedBoardSize])

  const handleCalculate = (e) => {
    e.preventDefault()
    setError('')

    // Validate timber types
    const boardTimberType = timberData.timberTypes.find(t => t.id === selectedBoardType)
    if (!boardTimberType) {
      setError('Please select a timber type for boards')
      return
    }

    const bearerTimberType = timberData.timberTypes.find(t => t.id === selectedBearerType)
    if (!bearerTimberType) {
      setError('Please select a timber type for bearers')
      return
    }

    const boardSize = boardTimberType.boardSizes.find(s => s.id === selectedBoardSize)
    if (!boardSize) {
      setError('Please select a board size')
      return
    }

    const bearerSize = bearerTimberType.bearerSizes.find(s => s.id === selectedBearerSize)
    if (!bearerSize) {
      setError('Please select a bearer size')
      return
    }

    const topBoards = parseInt(numberOfTopBoards)
    const bottomBoards = parseInt(numberOfBottomBoards)
    const bearers = parseInt(numberOfBearers)
    const width = parseFloat(palletWidth)
    const length = parseFloat(palletLength)

    if (isNaN(width) || width <= 0) {
      setError('Please enter a valid pallet width')
      return
    }

    if (isNaN(length) || length <= 0) {
      setError('Please enter a valid pallet length')
      return
    }

    if (isNaN(topBoards) || topBoards <= 0) {
      setError('Please enter a valid number of top boards')
      return
    }

    if (isNaN(bottomBoards) || bottomBoards <= 0) {
      setError('Please enter a valid number of bottom boards')
      return
    }

    if (isNaN(bearers) || bearers <= 0) {
      setError('Please enter a valid number of bearers')
      return
    }

    // Validate board fit
    const topValidation = validateInputs(width, boardSize.width, topBoards)
    if (!topValidation.valid) {
      setError('Top boards: ' + topValidation.error)
      return
    }

    const bottomValidation = validateInputs(width, boardSize.width, bottomBoards)
    if (!bottomValidation.valid) {
      setError('Bottom boards: ' + bottomValidation.error)
      return
    }

    // Calculate results
    const topGapSize = calculateGapSize(width, boardSize.width, topBoards)
    const bottomGapSize = calculateGapSize(width, boardSize.width, bottomBoards)
    const topBoardsTotal = calculateTotalPrice(boardSize.pricePerBoard, topBoards)
    const bearersTotal = calculateTotalPrice(bearerSize.pricePerBearer, bearers)
    const bottomBoardsTotal = calculateTotalPrice(boardSize.pricePerBoard, bottomBoards)
    
    // Calculate nails
    const topBoardNails = topBoards * bearers * 2
    const bottomBoardNails = bottomBoards * bearers * 2
    const totalNails = topBoardNails + bottomBoardNails
    const nailPrice = timberData.nailPricePerNail || 0.02
    const nailsTotal = calculateTotalPrice(nailPrice, totalNails)
    
    const totalPrice = parseFloat(topBoardsTotal) + parseFloat(bearersTotal) + parseFloat(bottomBoardsTotal) + parseFloat(nailsTotal)

    const quoteData = {
      timberType: boardTimberType.name,
      bearerTimberType: bearerTimberType.name,
      boardSize: boardSize.dimensions,
      bearerSize: bearerSize.dimensions,
      numberOfTopBoards: topBoards,
      numberOfBearers: bearers,
      numberOfBottomBoards: bottomBoards,
      pricePerBoard: boardSize.pricePerBoard,
      pricePerBearer: bearerSize.pricePerBearer,
      topBoardsTotal: parseFloat(topBoardsTotal),
      bearersTotal: parseFloat(bearersTotal),
      bottomBoardsTotal: parseFloat(bottomBoardsTotal),
      totalNails: totalNails,
      pricePerNail: nailPrice,
      nailsTotal: parseFloat(nailsTotal),
      totalPrice: totalPrice,
      palletWidth: width,
      palletLength: length,
      boardWidth: boardSize.width,
      topGapSize: topGapSize,
      bottomGapSize: bottomGapSize
    }

    onQuoteCalculated(quoteData)
  }

  const handleClear = () => {
    setPalletWidth('')
    setPalletLength('')
    setSelectedBoardType('')
    setSelectedBoardSize('')
    setNumberOfTopBoards('')
    setNumberOfBottomBoards('')
    setSelectedBearerType('')
    setSelectedBearerSize('')
    setNumberOfBearers('')
    setError('')
    onQuoteCalculated(null)
  }

  return (
    <div className="pallet-builder">
      {/* Form Panel */}
      <div className="builder-form-panel">
        <div className="form-card">
          <h2 className="form-title">Generate Quote</h2>
          
          <form onSubmit={handleCalculate} className="builder-form">
            {/* Pallet Dimensions */}
            <div className="form-section">
              <div className="form-row">
                <div className="form-field">
                  <label>Pallet Width (mm)</label>
                  <input
                    type="number"
                    value={palletWidth}
                    onChange={(e) => setPalletWidth(e.target.value)}
                    placeholder="e.g., 1200"
                  />
                </div>
                <div className="form-field">
                  <label>Pallet Length (mm)</label>
                  <input
                    type="number"
                    value={palletLength}
                    onChange={(e) => setPalletLength(e.target.value)}
                    placeholder="e.g., 1200"
                  />
                </div>
              </div>
            </div>

            <div className="form-divider"></div>

            {/* Board Section */}
            <div className="form-section">
              <div className="form-field">
                <label>Timber Type (Boards)</label>
                <select
                  value={selectedBoardType}
                  onChange={(e) => setSelectedBoardType(e.target.value)}
                >
                  <option value="">Select timber type...</option>
                  {timberData.timberTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Board Size (Top & Bottom)</label>
                <select
                  value={selectedBoardSize}
                  onChange={(e) => setSelectedBoardSize(e.target.value)}
                  disabled={!selectedBoardType}
                >
                  <option value="">Select board size...</option>
                  {availableBoardSizes.map(size => (
                    <option key={size.id} value={size.id}>
                      {size.dimensions}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>No. of Boards (TOP)</label>
                  <input
                    type="number"
                    value={numberOfTopBoards}
                    onChange={(e) => setNumberOfTopBoards(e.target.value)}
                    placeholder="e.g., 7"
                    min="0"
                  />
                </div>
                <div className="form-field">
                  <label>No. of Boards (BOTTOM)</label>
                  <input
                    type="number"
                    value={numberOfBottomBoards}
                    onChange={(e) => setNumberOfBottomBoards(e.target.value)}
                    placeholder="e.g., 3"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="form-divider"></div>

            {/* Bearer Section */}
            <div className="form-section">
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

              <div className="form-row">
                <div className="form-field">
                  <label>Bearer Size</label>
                  <select
                    value={selectedBearerSize}
                    onChange={(e) => setSelectedBearerSize(e.target.value)}
                    disabled={!selectedBearerType}
                  >
                    <option value="">Select bearer size...</option>
                    {availableBearerSizes.map(size => (
                      <option key={size.id} value={size.id}>
                        {size.dimensions}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>No. of Bearers</label>
                  <input
                    type="number"
                    value={numberOfBearers}
                    onChange={(e) => setNumberOfBearers(e.target.value)}
                    placeholder="e.g., 3"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="form-divider"></div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="form-actions">
              <button type="submit" className="btn-calculate">
                Calculate Quote
              </button>
              <button type="button" onClick={handleClear} className="btn-clear">
                Clear Form
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 3D Preview Panel */}
      <div className="builder-preview-panel">
        <Pallet3DLive previewData={livePreviewData} />
      </div>
    </div>
  )
}

export default PalletBuilder

