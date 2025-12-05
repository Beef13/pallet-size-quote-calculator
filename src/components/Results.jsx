import React from 'react'
import { formatCurrency, formatDimension } from '../utils/calculations'
import '../styles/Results.css'

function Results({ quoteData, onClose }) {
  if (!quoteData) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div className="results-modal" onClick={handleBackdropClick}>
      <div className="results-container">
        <button className="close-btn" onClick={onClose}>×</button>
        
        <h2>Quote Results</h2>
        
        <div className="results-card">
          <div className="results-section">
            <h3 className="section-title">Timber Details</h3>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Board Timber:</span>
                <span className="result-value">{quoteData.timberType}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Bearer Timber:</span>
                <span className="result-value">{quoteData.bearerTimberType || quoteData.timberType}</span>
              </div>
            </div>
          </div>

          <div className="results-section">
            <h3 className="section-title">Boards (Top & Bottom)</h3>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Board Size:</span>
                <span className="result-value">{quoteData.boardSize}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Top Boards:</span>
                <span className="result-value">{quoteData.numberOfTopBoards} boards</span>
              </div>

              <div className="result-item">
                <span className="result-label">Bottom Boards:</span>
                <span className="result-value">{quoteData.numberOfBottomBoards} boards</span>
              </div>

              <div className="result-item">
                <span className="result-label">Price per Board:</span>
                <span className="result-value">{formatCurrency(quoteData.pricePerBoard)}</span>
              </div>

              <div className="result-item subtotal">
                <span className="result-label">Top Boards Subtotal:</span>
                <span className="result-value">{formatCurrency(quoteData.topBoardsTotal)}</span>
              </div>

              <div className="result-item subtotal">
                <span className="result-label">Bottom Boards Subtotal:</span>
                <span className="result-value">{formatCurrency(quoteData.bottomBoardsTotal)}</span>
              </div>
            </div>
          </div>

          <div className="results-section">
            <h3 className="section-title">Bearers (Stringers)</h3>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Bearer Size:</span>
                <span className="result-value">{quoteData.bearerSize}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Quantity:</span>
                <span className="result-value">{quoteData.numberOfBearers} bearers</span>
              </div>

              <div className="result-item">
                <span className="result-label">Price per Bearer:</span>
                <span className="result-value">{formatCurrency(quoteData.pricePerBearer)}</span>
              </div>

              <div className="result-item subtotal">
                <span className="result-label">Bearers Subtotal:</span>
                <span className="result-value">{formatCurrency(quoteData.bearersTotal)}</span>
              </div>
            </div>
          </div>

          <div className="results-section">
            <h3 className="section-title">Nails & Hardware</h3>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Total Nails:</span>
                <span className="result-value">{quoteData.totalNails} nails</span>
              </div>

              <div className="result-item">
                <span className="result-label">Price per Nail:</span>
                <span className="result-value">{formatCurrency(quoteData.pricePerNail)}</span>
              </div>

              <div className="result-item subtotal">
                <span className="result-label">Nails Subtotal:</span>
                <span className="result-value">{formatCurrency(quoteData.nailsTotal)}</span>
              </div>
            </div>
          </div>

          <div className="results-section">
            <h3 className="section-title">Pallet Dimensions & Spacing</h3>
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Pallet Width:</span>
                <span className="result-value">{formatDimension(quoteData.palletWidth)}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Pallet Length:</span>
                <span className="result-value">{formatDimension(quoteData.palletLength)}</span>
              </div>

              <div className="result-item highlight">
                <span className="result-label">Top Board Gap:</span>
                <span className="result-value">{formatDimension(quoteData.topGapSize)}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Bottom Board Gap:</span>
                <span className="result-value">{formatDimension(quoteData.bottomGapSize)}</span>
              </div>
            </div>
          </div>

          <div className="total-section">
            <span className="total-label">Total Quote Price:</span>
            <span className="total-value">{formatCurrency(quoteData.totalPrice)}</span>
          </div>

          <div className="modal-actions">
            <button className="btn-print" onClick={() => window.print()}>
              🖨️ Print Quote
            </button>
            <button className="btn-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Results
