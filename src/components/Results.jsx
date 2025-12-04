import React from 'react'
import { formatCurrency, formatDimension } from '../utils/calculations'
import Pallet3D from './Pallet3D'
import '../styles/Results.css'

function Results({ quoteData }) {
  if (!quoteData) return null

  return (
    <div className="results-container">
      <h2>Quote Results</h2>
      
      <div className="results-card">
        <div className="results-section">
          <h3 className="section-title">Timber Type</h3>
          <div className="result-item-single">
            <span className="result-value">{quoteData.timberType}</span>
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

            <div className="result-item">
              <span className="result-label">Top Boards Subtotal:</span>
              <span className="result-value">{formatCurrency(quoteData.topBoardsTotal)}</span>
            </div>

            <div className="result-item">
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

            <div className="result-item">
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

            <div className="result-item">
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
              <span className="result-label">Top Gap:</span>
              <span className="result-value">{formatDimension(quoteData.topGapSize)}</span>
            </div>

            <div className="result-item">
              <span className="result-label">Bottom Gap:</span>
              <span className="result-value">{formatDimension(quoteData.bottomGapSize)}</span>
            </div>
          </div>
        </div>

        <div className="total-section">
          <span className="total-label">Total Quote Price:</span>
          <span className="total-value">{formatCurrency(quoteData.totalPrice)}</span>
        </div>

        <div className="visual-representation">
          <Pallet3D quoteData={quoteData} />
          
          <div className="cross-section-diagram-legacy" style={{ display: 'none' }}>
            {/* Top Boards */}
            <div className="layer-label">Top Boards ({quoteData.numberOfTopBoards})</div>
            <div className="pallet-layer top-layer">
              {Array.from({ length: quoteData.numberOfTopBoards }, (_, index) => {
                const boardWidthPercent = (quoteData.topBoardWidth / quoteData.palletWidth) * 100;
                const gapWidthPercent = quoteData.numberOfTopBoards > 1 
                  ? (quoteData.topGapSize / quoteData.palletWidth) * 100 
                  : 0;
                
                return (
                  <React.Fragment key={index}>
                    <div
                      className="board top-board"
                      style={{
                        width: `${boardWidthPercent}%`
                      }}
                    >
                      <span className="board-label">{quoteData.topBoardWidth}mm</span>
                    </div>
                    {index < quoteData.numberOfTopBoards - 1 && (
                      <div
                        className="board-gap"
                        style={{
                          width: `${gapWidthPercent}%`
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bearers */}
            <div className="layer-label">Bearers ({quoteData.numberOfBearers})</div>
            <div className="pallet-layer bearer-layer">
              <div style={{ 
                display: 'flex', 
                width: '100%', 
                alignItems: 'center',
                gap: 0
              }}>
                {Array.from({ length: quoteData.numberOfBearers }, (_, index) => {
                  // Calculate bearer spacing - assume bearers are ~75mm wide (typical)
                  const bearerWidth = 75;
                  const bearerWidthPercent = (bearerWidth / quoteData.palletWidth) * 100;
                  const totalBearerWidth = bearerWidth * quoteData.numberOfBearers;
                  const availableSpace = quoteData.palletWidth - totalBearerWidth;
                  const numberOfGaps = quoteData.numberOfBearers - 1;
                  const gapSize = numberOfGaps > 0 ? availableSpace / numberOfGaps : 0;
                  const gapWidthPercent = (gapSize / quoteData.palletWidth) * 100;
                  
                  return (
                    <React.Fragment key={index}>
                      <div 
                        className="bearer"
                        style={{
                          width: `${bearerWidthPercent}%`,
                          minWidth: '60px',
                          maxWidth: `${bearerWidthPercent}%`
                        }}
                      >
                        <span className="bearer-label">Bearer</span>
                      </div>
                      {index < quoteData.numberOfBearers - 1 && (
                        <div
                          className="bearer-gap"
                          style={{
                            width: `${gapWidthPercent}%`,
                            flexShrink: 0
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Bottom Boards */}
            <div className="layer-label">Bottom Boards ({quoteData.numberOfBottomBoards})</div>
            <div className="pallet-layer bottom-layer">
              {Array.from({ length: quoteData.numberOfBottomBoards }, (_, index) => {
                const boardWidthPercent = (quoteData.bottomBoardWidth / quoteData.palletWidth) * 100;
                const gapWidthPercent = quoteData.numberOfBottomBoards > 1 
                  ? (quoteData.bottomGapSize / quoteData.palletWidth) * 100 
                  : 0;
                
                return (
                  <React.Fragment key={index}>
                    <div
                      className="board bottom-board"
                      style={{
                        width: `${boardWidthPercent}%`
                      }}
                    >
                      <span className="board-label">{quoteData.bottomBoardWidth}mm</span>
                    </div>
                    {index < quoteData.numberOfBottomBoards - 1 && (
                      <div
                        className="board-gap"
                        style={{
                          width: `${gapWidthPercent}%`
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="diagram-labels">
              <span className="label-left">Edge: Flush</span>
              <span className="label-center">Total Width: {quoteData.palletWidth}mm</span>
              <span className="label-right">Edge: Flush</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Results

