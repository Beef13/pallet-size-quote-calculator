import React from 'react'
import '../styles/PrintableQuote.css'

function PrintableQuote({ quoteData, quantity = 1 }) {
  if (!quoteData) return null

  const {
    palletWidth,
    palletLength,
    topBoardSize,
    bottomBoardSize,
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
    topBoardTimberType,
    bottomBoardTimberType,
    bearerTimberType,
    pricePerTopBoard,
    pricePerBottomBoard,
    pricePerBearer
  } = quoteData

  const grandTotal = totalPrice * quantity

  // Parse actual dimensions from size strings (e.g., "100x19mm")
  const topBoardWidth = parseInt(topBoardSize?.split('x')[0]) || 100
  const topBoardThickness = parseInt(topBoardSize?.split('x')[1]) || 19
  const bottomBoardWidth = parseInt(bottomBoardSize?.split('x')[0]) || 100
  const bottomBoardThickness = parseInt(bottomBoardSize?.split('x')[1]) || 19
  const bearerWidth = parseInt(bearerSize?.split('x')[0]) || 100  // This is the standing height
  const bearerThickness = parseInt(bearerSize?.split('x')[1]) || 38  // This is the depth

  // Calculate pallet height (same as 3D model)
  const palletHeight = topBoardThickness + bearerWidth + bottomBoardThickness

  // Calculate gaps (same as 3D model)
  const topGap = topGapSize || 0
  const bottomGap = bottomGapSize || 0

  // SVG scaling - fit to viewbox while maintaining proportions
  // Increased padding to prevent clipping of dimension text
  const svgPadding = 80
  
  // Font sizes for dimensions - increased by 50% for readability
  const dimFontSize = Math.max(42, Math.round(palletWidth / 27))
  const dimFontSizeSmall = Math.max(36, Math.round(palletWidth / 33))

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
              viewBox={`0 0 ${palletWidth + 180} ${palletLength + 180}`} 
              className="diagram-svg"
              style={{ maxHeight: '220px' }}
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
                  : svgPadding + (i * (topBoardWidth + topGap))
                return (
                  <rect
                    key={`board-${i}`}
                    x={xPos}
                    y={svgPadding}
                    width={topBoardWidth}
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
              <line x1={svgPadding} y1="35" x2={svgPadding + palletWidth} y2="35" stroke="#000" strokeWidth="2" />
              <line x1={svgPadding} y1="20" x2={svgPadding} y2="50" stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletWidth} y1="20" x2={svgPadding + palletWidth} y2="50" stroke="#000" strokeWidth="2" />
              <text x={svgPadding + palletWidth/2} y="25" textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletWidth}</text>
              
              {/* Length dimension - right */}
              <line x1={svgPadding + palletWidth + 35} y1={svgPadding} x2={svgPadding + palletWidth + 35} y2={svgPadding + palletLength} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletWidth + 20} y1={svgPadding} x2={svgPadding + palletWidth + 50} y2={svgPadding} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletWidth + 20} y1={svgPadding + palletLength} x2={svgPadding + palletWidth + 50} y2={svgPadding + palletLength} stroke="#000" strokeWidth="2" />
              <text x={svgPadding + palletWidth + 65} y={svgPadding + palletLength/2} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold" transform={`rotate(90, ${svgPadding + palletWidth + 65}, ${svgPadding + palletLength/2})`}>{palletLength}</text>
              
              {/* Top gap dimension - between first two top boards */}
              {numberOfTopBoards >= 2 && topGap > 0 && (
                <>
                  <line 
                    x1={svgPadding + topBoardWidth} 
                    y1={svgPadding + palletLength + 30} 
                    x2={svgPadding + topBoardWidth + topGap} 
                    y2={svgPadding + palletLength + 30} 
                    stroke="#000" 
                    strokeWidth="2" 
                  />
                  <line 
                    x1={svgPadding + topBoardWidth} 
                    y1={svgPadding + palletLength + 15} 
                    x2={svgPadding + topBoardWidth} 
                    y2={svgPadding + palletLength + 45} 
                    stroke="#000" 
                    strokeWidth="2" 
                  />
                  <line 
                    x1={svgPadding + topBoardWidth + topGap} 
                    y1={svgPadding + palletLength + 15} 
                    x2={svgPadding + topBoardWidth + topGap} 
                    y2={svgPadding + palletLength + 45} 
                    stroke="#000" 
                    strokeWidth="2" 
                  />
                  <text 
                    x={svgPadding + topBoardWidth + topGap/2} 
                    y={svgPadding + palletLength + 70} 
                    textAnchor="middle" 
                    fontSize={dimFontSizeSmall} 
                    fontFamily="Arial"
                    fontWeight="bold"
                  >
                    {Math.round(topGap)} top
                  </text>
                </>
              )}
              
              {/* Bottom gap dimension - between first two bottom boards */}
              {numberOfBottomBoards >= 2 && bottomGap > 0 && (
                <>
                  <line 
                    x1={svgPadding + palletWidth - bottomBoardWidth - bottomGap} 
                    y1={svgPadding + palletLength + 30} 
                    x2={svgPadding + palletWidth - bottomBoardWidth} 
                    y2={svgPadding + palletLength + 30} 
                    stroke="#000" 
                    strokeWidth="2" 
                  />
                  <line 
                    x1={svgPadding + palletWidth - bottomBoardWidth - bottomGap} 
                    y1={svgPadding + palletLength + 15} 
                    x2={svgPadding + palletWidth - bottomBoardWidth - bottomGap} 
                    y2={svgPadding + palletLength + 45} 
                    stroke="#000" 
                    strokeWidth="2" 
                  />
                  <line 
                    x1={svgPadding + palletWidth - bottomBoardWidth} 
                    y1={svgPadding + palletLength + 15} 
                    x2={svgPadding + palletWidth - bottomBoardWidth} 
                    y2={svgPadding + palletLength + 45} 
                    stroke="#000" 
                    strokeWidth="2" 
                  />
                  <text 
                    x={svgPadding + palletWidth - bottomBoardWidth - bottomGap/2} 
                    y={svgPadding + palletLength + 70} 
                    textAnchor="middle" 
                    fontSize={dimFontSizeSmall} 
                    fontFamily="Arial"
                    fontWeight="bold"
                  >
                    {Math.round(bottomGap)} btm
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Front Elevation - Looking at the width side */}
          <div className="diagram-box">
            <div className="diagram-label">FRONT ELEVATION</div>
            <svg 
              viewBox={`0 0 ${palletWidth + 180} ${palletHeight + 140}`} 
              className="diagram-svg"
              style={{ maxHeight: '160px' }}
            >
              {/* Top board layer */}
              <rect 
                x={svgPadding} 
                y={svgPadding} 
                width={palletWidth} 
                height={topBoardThickness} 
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
                      y={svgPadding + topBoardThickness}
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
                y={svgPadding + topBoardThickness + bearerWidth} 
                width={palletWidth} 
                height={bottomBoardThickness} 
                fill="none" 
                stroke="#000" 
                strokeWidth="1.5" 
              />
              
              {/* Width dimension */}
              <line x1={svgPadding} y1={svgPadding + palletHeight + 35} x2={svgPadding + palletWidth} y2={svgPadding + palletHeight + 35} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding} y1={svgPadding + palletHeight + 20} x2={svgPadding} y2={svgPadding + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletWidth} y1={svgPadding + palletHeight + 20} x2={svgPadding + palletWidth} y2={svgPadding + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <text x={svgPadding + palletWidth/2} y={svgPadding + palletHeight + 75} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletWidth}</text>
              
              {/* Height dimension */}
              <line x1="35" y1={svgPadding} x2="35" y2={svgPadding + palletHeight} stroke="#000" strokeWidth="2" />
              <line x1="20" y1={svgPadding} x2="50" y2={svgPadding} stroke="#000" strokeWidth="2" />
              <line x1="20" y1={svgPadding + palletHeight} x2="50" y2={svgPadding + palletHeight} stroke="#000" strokeWidth="2" />
              <text x="25" y={svgPadding + palletHeight/2} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold" transform={`rotate(-90, 25, ${svgPadding + palletHeight/2})`}>{palletHeight}</text>
            </svg>
          </div>

          {/* Side Elevation - Looking at the length side */}
          <div className="diagram-box">
            <div className="diagram-label">SIDE ELEVATION</div>
            <svg 
              viewBox={`0 0 ${palletLength + 180} ${palletHeight + 140}`} 
              className="diagram-svg"
              style={{ maxHeight: '160px' }}
            >
              {/* Top boards - end grain view */}
              {(() => {
                const scaledBoardWidth = topBoardWidth * (palletLength / palletWidth)
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
                      height={topBoardThickness}
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
                y={svgPadding + topBoardThickness} 
                width={palletLength} 
                height={bearerWidth} 
                fill="none" 
                stroke="#000" 
                strokeWidth="1.5" 
              />
              
              {/* Bottom boards - end grain view */}
              {(() => {
                const scaledBoardWidth = bottomBoardWidth * (palletLength / palletWidth)
                const scaledGap = bottomGap * (palletLength / palletWidth)
                const totalBoardsWidth = numberOfBottomBoards * scaledBoardWidth + (numberOfBottomBoards - 1) * scaledGap
                const startX = svgPadding + (palletLength - totalBoardsWidth) / 2
                
                return Array.from({ length: numberOfBottomBoards }).map((_, i) => {
                  const xPos = startX + (i * (scaledBoardWidth + scaledGap))
                  return (
                    <rect
                      key={`bottom-side-${i}`}
                      x={xPos}
                      y={svgPadding + topBoardThickness + bearerWidth}
                      width={scaledBoardWidth}
                      height={bottomBoardThickness}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1"
                    />
                  )
                })
              })()}
              
              {/* Length dimension */}
              <line x1={svgPadding} y1={svgPadding + palletHeight + 35} x2={svgPadding + palletLength} y2={svgPadding + palletHeight + 35} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding} y1={svgPadding + palletHeight + 20} x2={svgPadding} y2={svgPadding + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletLength} y1={svgPadding + palletHeight + 20} x2={svgPadding + palletLength} y2={svgPadding + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <text x={svgPadding + palletLength/2} y={svgPadding + palletHeight + 75} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletLength}</text>
              
              {/* Height dimension */}
              <line x1={svgPadding + palletLength + 35} y1={svgPadding} x2={svgPadding + palletLength + 35} y2={svgPadding + palletHeight} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletLength + 20} y1={svgPadding} x2={svgPadding + palletLength + 50} y2={svgPadding} stroke="#000" strokeWidth="2" />
              <line x1={svgPadding + palletLength + 20} y1={svgPadding + palletHeight} x2={svgPadding + palletLength + 50} y2={svgPadding + palletHeight} stroke="#000" strokeWidth="2" />
              <text x={svgPadding + palletLength + 65} y={svgPadding + palletHeight/2} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold" transform={`rotate(90, ${svgPadding + palletLength + 65}, ${svgPadding + palletHeight/2})`}>{palletHeight}</text>
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
              <td>{topBoardTimberType}</td>
              <td>{topBoardSize}</td>
              <td>{numberOfTopBoards}</td>
              <td>{pricePerTopBoard?.toFixed(2)}</td>
              <td className="amount-col">${topBoardsTotal?.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Bottom Boards</td>
              <td>{bottomBoardTimberType}</td>
              <td>{bottomBoardSize}</td>
              <td>{numberOfBottomBoards}</td>
              <td>{pricePerBottomBoard?.toFixed(2)}</td>
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
