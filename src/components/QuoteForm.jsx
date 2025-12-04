import { useState, useEffect } from 'react'
import timberData from '../data/timber-prices.json'
import { calculateGapSize, calculateTotalPrice, validateInputs } from '../utils/calculations'
import '../styles/QuoteForm.css'

function QuoteForm({ onQuoteCalculated }) {
  const [selectedType, setSelectedType] = useState('')
  const [selectedBoardSize, setSelectedBoardSize] = useState('')
  const [selectedBearerSize, setSelectedBearerSize] = useState('')
  const [numberOfTopBoards, setNumberOfTopBoards] = useState('')
  const [numberOfBottomBoards, setNumberOfBottomBoards] = useState('')
  const [numberOfBearers, setNumberOfBearers] = useState('')
  const [palletWidth, setPalletWidth] = useState('')
  const [palletLength, setPalletLength] = useState('')
  const [error, setError] = useState('')
  const [availableBoardSizes, setAvailableBoardSizes] = useState([])
  const [availableBearerSizes, setAvailableBearerSizes] = useState([])

  // Update available sizes when timber type changes
  useEffect(() => {
    if (selectedType) {
      const timberType = timberData.timberTypes.find(t => t.id === selectedType)
      setAvailableBoardSizes(timberType ? timberType.boardSizes : [])
      setAvailableBearerSizes(timberType ? timberType.bearerSizes : [])
      setSelectedBoardSize('') // Reset board size selection
      setSelectedBearerSize('') // Reset bearer size selection
    } else {
      setAvailableBoardSizes([])
      setAvailableBearerSizes([])
    }
  }, [selectedType])

  const handleCalculate = (e) => {
    e.preventDefault()
    setError('')

    // Find selected timber and sizes
    const timberType = timberData.timberTypes.find(t => t.id === selectedType)
    if (!timberType) {
      setError('Please select a timber type')
      return
    }

    const boardSize = timberType.boardSizes.find(s => s.id === selectedBoardSize)
    if (!boardSize) {
      setError('Please select a board size')
      return
    }

    const bearerSize = timberType.bearerSizes.find(s => s.id === selectedBearerSize)
    if (!bearerSize) {
      setError('Please select a bearer size')
      return
    }

    const topBoards = parseInt(numberOfTopBoards)
    const bottomBoards = parseInt(numberOfBottomBoards)
    const bearers = parseInt(numberOfBearers)
    const width = parseFloat(palletWidth)
    const length = parseFloat(palletLength)

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

    if (isNaN(width) || width <= 0) {
      setError('Please enter a valid pallet width')
      return
    }

    if (isNaN(length) || length <= 0) {
      setError('Please enter a valid pallet length')
      return
    }

    // Validate inputs
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
    
    // Calculate nails: 2 nails per board-bearer intersection
    const topBoardNails = topBoards * bearers * 2
    const bottomBoardNails = bottomBoards * bearers * 2
    const totalNails = topBoardNails + bottomBoardNails
    const nailPrice = timberData.nailPricePerNail || 0.02
    const nailsTotal = calculateTotalPrice(nailPrice, totalNails)
    
    const totalPrice = parseFloat(topBoardsTotal) + parseFloat(bearersTotal) + parseFloat(bottomBoardsTotal) + parseFloat(nailsTotal)

    const quoteData = {
      timberType: timberType.name,
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

  const handleReset = () => {
    setSelectedType('')
    setSelectedBoardSize('')
    setSelectedBearerSize('')
    setNumberOfTopBoards('')
    setNumberOfBottomBoards('')
    setNumberOfBearers('')
    setPalletWidth('')
    setPalletLength('')
    setError('')
    onQuoteCalculated(null)
  }

  return (
    <div className="quote-form-container">
      <h2>Generate Quote</h2>
      
      <form onSubmit={handleCalculate} className="quote-form">
        <div className="form-group">
          <label htmlFor="timberType">Timber Type</label>
          <select
            id="timberType"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            required
          >
            <option value="">Select timber type...</option>
            {timberData.timberTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="boardSize">Board Size (Top & Bottom)</label>
          <select
            id="boardSize"
            value={selectedBoardSize}
            onChange={(e) => setSelectedBoardSize(e.target.value)}
            disabled={!selectedType}
            required
          >
            <option value="">Select board size...</option>
            {availableBoardSizes.map(size => (
              <option key={size.id} value={size.id}>
                {size.dimensions} - ${size.pricePerBoard.toFixed(2)}/board
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="numberOfTopBoards">Number of Top Boards</label>
            <input
              type="number"
              id="numberOfTopBoards"
              value={numberOfTopBoards}
              onChange={(e) => setNumberOfTopBoards(e.target.value)}
              min="1"
              step="1"
              placeholder="e.g., 7"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="numberOfBottomBoards">Number of Bottom Boards</label>
            <input
              type="number"
              id="numberOfBottomBoards"
              value={numberOfBottomBoards}
              onChange={(e) => setNumberOfBottomBoards(e.target.value)}
              min="1"
              step="1"
              placeholder="e.g., 3"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="bearerSize">Bearer Size (Stringers)</label>
          <select
            id="bearerSize"
            value={selectedBearerSize}
            onChange={(e) => setSelectedBearerSize(e.target.value)}
            disabled={!selectedType}
            required
          >
            <option value="">Select bearer size...</option>
            {availableBearerSizes.map(size => (
              <option key={size.id} value={size.id}>
                {size.dimensions} - ${size.pricePerBearer.toFixed(2)}/bearer
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="numberOfBearers">Number of Bearers</label>
          <input
            type="number"
            id="numberOfBearers"
            value={numberOfBearers}
            onChange={(e) => setNumberOfBearers(e.target.value)}
            min="1"
            step="1"
            placeholder="e.g., 3"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="palletWidth">Pallet Width (mm)</label>
          <input
            type="number"
            id="palletWidth"
            value={palletWidth}
            onChange={(e) => setPalletWidth(e.target.value)}
            min="1"
            step="1"
            placeholder="e.g., 1200"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="palletLength">Pallet Length (mm)</label>
          <input
            type="number"
            id="palletLength"
            value={palletLength}
            onChange={(e) => setPalletLength(e.target.value)}
            min="1"
            step="1"
            placeholder="e.g., 800"
            required
          />
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Calculate Quote
          </button>
          <button type="button" onClick={handleReset} className="btn btn-secondary">
            Clear Form
          </button>
        </div>
      </form>
    </div>
  )
}

export default QuoteForm

