import React from 'react'
import '../styles/PrintableQuote.css'

function PrintableQuote({ quoteData, quantity = 1 }) {
  if (!quoteData) return null

  const {
    palletWidth,
    palletLength,
    boardSize,
    bearerSize,
    numberOfTopBoards,
    numberOfBottomBoards,
    numberOfBearers,
    topBoardsTotal,
    bottomBoardsTotal,
    bearersTotal,
    nailsTotal,
    totalNails,
    totalPrice,
    topGapSize,
    bottomGapSize,
    timberType,
    bearerTimberType,
    pricePerBoard,
    pricePerBearer,
    boardWidth: actualBoardWidth
  } = quoteData

  const grandTotal = totalPrice * quantity

  // Parse actual dimensions from size strings (e.g., "100x19mm")
  const boardWidth = actualBoardWidth || parseInt(boardSize?.split('x')[0]) || 100
  const boardThickness = parseInt(boardSize?.split('x')[1]) || 19
  const bearerWidth = parseInt(bearerSize?.split('x')[0]) || 100  // This is the standing height
  const bearerThickness = parseInt(bearerSize?.split('x')[1]) || 38  // This is the depth

  // Calculate pallet height (same as 3D model)
  const palletHeight = boardThickness + bearerWidth + boardThickness

  // Calculate gaps (same as 3D model)
  const topGap = topGapSize || 0
  const bottomGap = bottomGapSize || 0

  // SVG scaling - fit to viewbox while maintaining proportions
  const svgPadding = 40
  
  // Font sizes for dimensions (larger for readability)
  const dimFontSize = Math.max(28, Math.round(palletWidth / 40))
  const dimFontSizeSmall = Math.max(24, Math.round(palletWidth / 50))

  const today = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  return (
    <div className="printable-quote">
      {/* Header */}
      <div className="print-header">
        <h1>PALLET QUOTE</h1>
        <div className="print-meta">
          <span>Date: {today}</span>
          <span>Qty: {quantity}</span>
        </div>
      </div>

      {/* Diagrams with accurate proportions */}
      <div className="diagram-section">
        <div className="diagrams-row">
          
          {/* Plan View (Top-down) - Shows boards running across width, bearers along length */}
          <div className="diagram-box">
            <div className="diagram-label">PLAN VIEW</div>
            <svg 
              viewBox={`0 0 ${palletWidth + 100} ${palletLength + 100}`} 
              className="diagram-svg"
              style={{ maxHeight: '200px' }}
            >
              {/* Pallet outline */}
              <rect 
                x={svgPadding} 
                y={svgPadding} 
                width={palletWidth} 
                height={palletLength} 
                fill="none" 
                stroke="#000" 
                strokeWidth="3" 
              />
              
              {/* Top boards - run across the width (horizontal in plan view) */}
              {Array.from({ length: numberOfTopBoards }).map((_, i) => {
                const xPos = i === 0 
                  ? svgPadding
                  : svgPadding + (i * (boardWidth + topGap))
                return (
                  <rect
                    key={`board-${i}`}
                    x={xPos}
                    y={svgPadding}
                    width={boardWidth}
                    height={palletLength}
                    fill="none"
                    stroke="#000"
                    strokeWidth="1.5"
                  />
                )
              })}
              
              {/* Bearers - run along the length (vertical lines, dashed) */}
              {(() => {
                const totalBearerDepth = bearerThickness * numberOfBearers
                const availableSpace = palletLength - totalBearerDepth
                const gapCount = numberOfBearers - 1
                const gapSize = gapCount > 0 ? availableSpace / gapCount : 0
                
                return Array.from({ length: numberOfBearers }).map((_, i) => {
                  const yPos = i === 0
                    ? svgPadding
                    : svgPadding + (i * (bearerThickness + gapSize))
                  return (
                    <rect
                      key={`bearer-${i}`}
                      x={svgPadding}
                      y={yPos}
                      width={palletWidth}
                      height={bearerThickness}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1"
                      strokeDasharray="8,4"
                    />
                  )
                })
              })()}
              
              {/* Width dimension - top */}
              <line x1={svgPadding} y1="18" x2={svgPadding + palletWidth} y2="18" stroke="#000" strokeWidth="1" />
              <line x1={svgPadding} y1="10" x2={svgPadding} y2="26" stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletWidth} y1="10" x2={svgPadding + palletWidth} y2="26" stroke="#000" strokeWidth="1" />
              <text x={svgPadding + palletWidth/2} y="14" textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletWidth}</text>
              
              {/* Length dimension - right */}
              <line x1={svgPadding + palletWidth + 18} y1={svgPadding} x2={svgPadding + palletWidth + 18} y2={svgPadding + palletLength} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletWidth + 10} y1={svgPadding} x2={svgPadding + palletWidth + 26} y2={svgPadding} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletWidth + 10} y1={svgPadding + palletLength} x2={svgPadding + palletWidth + 26} y2={svgPadding + palletLength} stroke="#000" strokeWidth="1" />
              <text x={svgPadding + palletWidth + 35} y={svgPadding + palletLength/2} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold" transform={`rotate(90, ${svgPadding + palletWidth + 35}, ${svgPadding + palletLength/2})`}>{palletLength}</text>
              
              {/* Gap dimension - between first two boards */}
              {numberOfTopBoards >= 2 && topGap > 0 && (
                <>
                  <line 
                    x1={svgPadding + boardWidth} 
                    y1={svgPadding + palletLength + 15} 
                    x2={svgPadding + boardWidth + topGap} 
                    y2={svgPadding + palletLength + 15} 
                    stroke="#000" 
                    strokeWidth="1" 
                  />
                  <line 
                    x1={svgPadding + boardWidth} 
                    y1={svgPadding + palletLength + 8} 
                    x2={svgPadding + boardWidth} 
                    y2={svgPadding + palletLength + 22} 
                    stroke="#000" 
                    strokeWidth="1" 
                  />
                  <line 
                    x1={svgPadding + boardWidth + topGap} 
                    y1={svgPadding + palletLength + 8} 
                    x2={svgPadding + boardWidth + topGap} 
                    y2={svgPadding + palletLength + 22} 
                    stroke="#000" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={svgPadding + boardWidth + topGap/2} 
                    y={svgPadding + palletLength + 38} 
                    textAnchor="middle" 
                    fontSize={dimFontSizeSmall} 
                    fontFamily="Arial"
                    fontWeight="bold"
                  >
                    {Math.round(topGap)} gap
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Front Elevation - Looking at the width side */}
          <div className="diagram-box">
            <div className="diagram-label">FRONT ELEVATION</div>
            <svg 
              viewBox={`0 0 ${palletWidth + 100} ${palletHeight + 80}`} 
              className="diagram-svg"
              style={{ maxHeight: '140px' }}
            >
              {/* Top board layer */}
              <rect 
                x={svgPadding} 
                y={svgPadding} 
                width={palletWidth} 
                height={boardThickness} 
                fill="none" 
                stroke="#000" 
                strokeWidth="1.5" 
              />
              
              {/* Bearers - evenly distributed across width */}
              {(() => {
                const bearerVisualWidth = 30 // Fixed visual width for bearers in front view
                const totalBearerWidth = bearerVisualWidth * numberOfBearers
                const availableSpace = palletWidth - totalBearerWidth
                const gapCount = numberOfBearers - 1
                const gapSize = gapCount > 0 ? availableSpace / gapCount : (palletWidth - bearerVisualWidth) / 2
                
                return Array.from({ length: numberOfBearers }).map((_, i) => {
                  const xPos = numberOfBearers === 1 
                    ? svgPadding + (palletWidth - bearerVisualWidth) / 2
                    : svgPadding + (i * (bearerVisualWidth + gapSize))
                  return (
                    <rect
                      key={`bearer-front-${i}`}
                      x={xPos}
                      y={svgPadding + boardThickness}
                      width={bearerVisualWidth}
                      height={bearerWidth}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1.5"
                    />
                  )
                })
              })()}
              
              {/* Bottom board layer */}
              <rect 
                x={svgPadding} 
                y={svgPadding + boardThickness + bearerWidth} 
                width={palletWidth} 
                height={boardThickness} 
                fill="none" 
                stroke="#000" 
                strokeWidth="1.5" 
              />
              
              {/* Width dimension */}
              <line x1={svgPadding} y1={svgPadding + palletHeight + 18} x2={svgPadding + palletWidth} y2={svgPadding + palletHeight + 18} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding} y1={svgPadding + palletHeight + 10} x2={svgPadding} y2={svgPadding + palletHeight + 26} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletWidth} y1={svgPadding + palletHeight + 10} x2={svgPadding + palletWidth} y2={svgPadding + palletHeight + 26} stroke="#000" strokeWidth="1" />
              <text x={svgPadding + palletWidth/2} y={svgPadding + palletHeight + 42} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletWidth}</text>
              
              {/* Height dimension */}
              <line x1="18" y1={svgPadding} x2="18" y2={svgPadding + palletHeight} stroke="#000" strokeWidth="1" />
              <line x1="10" y1={svgPadding} x2="26" y2={svgPadding} stroke="#000" strokeWidth="1" />
              <line x1="10" y1={svgPadding + palletHeight} x2="26" y2={svgPadding + palletHeight} stroke="#000" strokeWidth="1" />
              <text x="16" y={svgPadding + palletHeight/2} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold" transform={`rotate(-90, 16, ${svgPadding + palletHeight/2})`}>{palletHeight}</text>
            </svg>
          </div>

          {/* Side Elevation - Looking at the length side */}
          <div className="diagram-box">
            <div className="diagram-label">SIDE ELEVATION</div>
            <svg 
              viewBox={`0 0 ${palletLength + 100} ${palletHeight + 80}`} 
              className="diagram-svg"
              style={{ maxHeight: '140px' }}
            >
              {/* Top boards - end grain view */}
              {(() => {
                const scaledBoardWidth = boardWidth * (palletLength / palletWidth)
                const scaledGap = topGap * (palletLength / palletWidth)
                const totalBoardsWidth = numberOfTopBoards * scaledBoardWidth + (numberOfTopBoards - 1) * scaledGap
                const startX = svgPadding + (palletLength - totalBoardsWidth) / 2
                
                return Array.from({ length: numberOfTopBoards }).map((_, i) => {
                  const xPos = startX + (i * (scaledBoardWidth + scaledGap))
                  return (
                    <rect
                      key={`top-side-${i}`}
                      x={xPos}
                      y={svgPadding}
                      width={scaledBoardWidth}
                      height={boardThickness}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1"
                    />
                  )
                })
              })()}
              
              {/* Bearer - full length (this is what you see from the side) */}
              <rect 
                x={svgPadding} 
                y={svgPadding + boardThickness} 
                width={palletLength} 
                height={bearerWidth} 
                fill="none" 
                stroke="#000" 
                strokeWidth="1.5" 
              />
              
              {/* Bottom boards - end grain view */}
              {(() => {
                const scaledBoardWidth = boardWidth * (palletLength / palletWidth)
                const scaledGap = bottomGap * (palletLength / palletWidth)
                const totalBoardsWidth = numberOfBottomBoards * scaledBoardWidth + (numberOfBottomBoards - 1) * scaledGap
                const startX = svgPadding + (palletLength - totalBoardsWidth) / 2
                
                return Array.from({ length: numberOfBottomBoards }).map((_, i) => {
                  const xPos = startX + (i * (scaledBoardWidth + scaledGap))
                  return (
                    <rect
                      key={`bottom-side-${i}`}
                      x={xPos}
                      y={svgPadding + boardThickness + bearerWidth}
                      width={scaledBoardWidth}
                      height={boardThickness}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1"
                    />
                  )
                })
              })()}
              
              {/* Length dimension */}
              <line x1={svgPadding} y1={svgPadding + palletHeight + 18} x2={svgPadding + palletLength} y2={svgPadding + palletHeight + 18} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding} y1={svgPadding + palletHeight + 10} x2={svgPadding} y2={svgPadding + palletHeight + 26} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletLength} y1={svgPadding + palletHeight + 10} x2={svgPadding + palletLength} y2={svgPadding + palletHeight + 26} stroke="#000" strokeWidth="1" />
              <text x={svgPadding + palletLength/2} y={svgPadding + palletHeight + 42} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletLength}</text>
              
              {/* Height dimension */}
              <line x1={svgPadding + palletLength + 18} y1={svgPadding} x2={svgPadding + palletLength + 18} y2={svgPadding + palletHeight} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletLength + 10} y1={svgPadding} x2={svgPadding + palletLength + 26} y2={svgPadding} stroke="#000" strokeWidth="1" />
              <line x1={svgPadding + palletLength + 10} y1={svgPadding + palletHeight} x2={svgPadding + palletLength + 26} y2={svgPadding + palletHeight} stroke="#000" strokeWidth="1" />
              <text x={svgPadding + palletLength + 35} y={svgPadding + palletHeight/2} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold" transform={`rotate(90, ${svgPadding + palletLength + 35}, ${svgPadding + palletHeight/2})`}>{palletHeight}</text>
            </svg>
          </div>
        </div>

        {/* Dimension summary */}
        <div className="dimension-summary">
          <span><strong>Overall:</strong> {palletWidth} × {palletLength} × {palletHeight}mm</span>
          <span><strong>Top Gap:</strong> {Math.round(topGap)}mm</span>
          <span><strong>Bottom Gap:</strong> {Math.round(bottomGap)}mm</span>
        </div>
      </div>

      {/* Quote Summary */}
      <div className="quote-section">
        <table className="quote-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Material</th>
              <th>Size</th>
              <th>Qty</th>
              <th>$/m</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Top Boards</td>
              <td>{timberType}</td>
              <td>{boardSize}</td>
              <td>{numberOfTopBoards}</td>
              <td>{pricePerBoard?.toFixed(2)}</td>
              <td className="amount-col">${topBoardsTotal?.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Bottom Boards</td>
              <td>{timberType}</td>
              <td>{boardSize}</td>
              <td>{numberOfBottomBoards}</td>
              <td>{pricePerBoard?.toFixed(2)}</td>
              <td className="amount-col">${bottomBoardsTotal?.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Bearers</td>
              <td>{bearerTimberType}</td>
              <td>{bearerSize}</td>
              <td>{numberOfBearers}</td>
              <td>{pricePerBearer?.toFixed(2)}</td>
              <td className="amount-col">${bearersTotal?.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Nails</td>
              <td>—</td>
              <td>—</td>
              <td>{totalNails}</td>
              <td>—</td>
              <td className="amount-col">${nailsTotal?.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        
        {/* Totals - aligned right, no borders */}
        <div className="totals-section">
          <div className="total-line">
            <span className="total-label">Per Pallet</span>
            <span className="total-value">${totalPrice?.toFixed(2)}</span>
          </div>
          {quantity > 1 && (
            <div className="total-line qty-line">
              <span className="total-label">× {quantity} pallets</span>
              <span className="total-value"></span>
            </div>
          )}
          <div className="total-line grand-total">
            <span className="total-label">TOTAL</span>
            <span className="total-value">${grandTotal?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="print-footer">
        Quote valid for 30 days
      </div>
    </div>
  )
}

export default PrintableQuote
