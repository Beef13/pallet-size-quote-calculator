import React from 'react'
import '../styles/PrintableQuote.css'

// Positions (left edge) and sizes of each board across the pallet width,
// boards flush with both edges, leaders on the outside when used.
function deckLayout(count, boardWidth, boardThickness, leaderWidth, leaderThickness, gap) {
  const boards = []
  let x = 0
  for (let i = 0; i < count; i++) {
    const isLeader = leaderWidth > 0 && count >= 2 && (i === 0 || i === count - 1)
    const w = isLeader ? leaderWidth : boardWidth
    const t = isLeader ? leaderThickness : boardThickness
    boards.push({ x, w, t, isLeader })
    x += w + gap
  }
  return boards
}

// Positions of bearers along the pallet length (flush with both ends)
function bearerLayout(count, thickness, length) {
  if (count <= 0) return []
  if (count === 1) return [0]
  const gap = (length - count * thickness) / (count - 1)
  return Array.from({ length: count }, (_, i) => i * (thickness + gap))
}

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`
const metres = (mm) => `${((Number(mm) || 0) / 1000).toFixed(3)} m`

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
    pricePerNail,
    totalPrice,
    topGapSize,
    bottomGapSize,
    topBoardTimberType,
    bottomBoardTimberType,
    bearerTimberType,
    pricePerTopBoard,
    pricePerBottomBoard,
    pricePerBearer,
    boardLength,
    bearerLength,
    // Leader board data
    topLeaderTimberType,
    topLeaderSize,
    topLeaderCount,
    topInnerBoards,
    topLeadersTotal,
    pricePerTopLeader,
    bottomLeaderTimberType,
    bottomLeaderSize,
    bottomLeaderCount,
    bottomInnerBoards,
    bottomLeadersTotal,
    pricePerBottomLeader
  } = quoteData

  const grandTotal = totalPrice * quantity

  // Actual dimensions (fall back to sensible defaults for partial quotes)
  const topBoardWidth = quoteData.topBoardWidth || 100
  const topBoardThickness = quoteData.topBoardThickness || 19
  const bottomBoardWidth = quoteData.bottomBoardWidth || 100
  const bottomBoardThickness = quoteData.bottomBoardThickness || 19
  const topLeaderWidth = topLeaderCount > 0 ? quoteData.topLeaderWidth : 0
  const topLeaderThickness = topLeaderCount > 0 ? quoteData.topLeaderThickness : 0
  const bottomLeaderWidth = bottomLeaderCount > 0 ? quoteData.bottomLeaderWidth : 0
  const bottomLeaderThickness = bottomLeaderCount > 0 ? quoteData.bottomLeaderThickness : 0
  const bearerHeight = quoteData.bearerWidth || 100     // bearers stand on edge: width is the height
  const bearerThickness = quoteData.bearerThickness || 38

  const topGap = Math.max(0, topGapSize || 0)
  const bottomGap = Math.max(0, bottomGapSize || 0)

  const topBoards = deckLayout(numberOfTopBoards, topBoardWidth, topBoardThickness, topLeaderWidth, topLeaderThickness, topGap)
  const bottomBoards = deckLayout(numberOfBottomBoards, bottomBoardWidth, bottomBoardThickness, bottomLeaderWidth, bottomLeaderThickness, bottomGap)
  const bearers = bearerLayout(numberOfBearers, bearerThickness, palletLength)

  const topThickness = Math.max(topBoardThickness, topLeaderThickness)
  const bottomThickness = Math.max(bottomBoardThickness, bottomLeaderThickness)
  const palletHeight = topThickness + bearerHeight + bottomThickness

  const hasDimensions = palletWidth > 0 && palletLength > 0

  // SVG layout
  const pad = 80
  const dimFontSize = Math.max(42, Math.round(Math.max(palletWidth, palletLength) / 27))
  const dimFontSizeSmall = Math.max(36, Math.round(Math.max(palletWidth, palletLength) / 33))

  // Y positions in the elevations (top of drawing = top of pallet)
  const bearerTopY = pad + topThickness
  const bearerBottomY = bearerTopY + bearerHeight

  const today = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  // Table rows - only items that are actually on the pallet
  const rows = []
  if (topLeaderCount > 0) rows.push(['Top Leaders', topLeaderTimberType, topLeaderSize, topLeaderCount, boardLength, pricePerTopLeader, topLeadersTotal])
  if (topBoardSize && topInnerBoards > 0) rows.push(['Top Boards', topBoardTimberType, topBoardSize, topInnerBoards, boardLength, pricePerTopBoard, topBoardsTotal])
  if (bottomLeaderCount > 0) rows.push(['Bottom Leaders', bottomLeaderTimberType, bottomLeaderSize, bottomLeaderCount, boardLength, pricePerBottomLeader, bottomLeadersTotal])
  if (bottomBoardSize && bottomInnerBoards > 0) rows.push(['Bottom Boards', bottomBoardTimberType, bottomBoardSize, bottomInnerBoards, boardLength, pricePerBottomBoard, bottomBoardsTotal])
  if (bearerSize && numberOfBearers > 0) rows.push(['Bearers', bearerTimberType, bearerSize, numberOfBearers, bearerLength, pricePerBearer, bearersTotal])

  return (
    <div className="printable-quote">
      {/* Header */}
      <div className="print-header">
        <h1>Pallet quote</h1>
        <div className="print-meta">
          <span>Date: {today}</span>
          <span>Qty: {quantity}</span>
        </div>
      </div>

      {/* Diagrams with accurate proportions */}
      {hasDimensions && (
      <div className="diagram-section">
        <div className="diagrams-row">

          {/* Plan View (top-down): width across, length down. Deck boards run the length, bearers run the width. */}
          <div className="diagram-box">
            <div className="diagram-label">Plan view</div>
            <svg
              viewBox={`0 0 ${palletWidth + 180} ${palletLength + 180}`}
              className="diagram-svg"
              style={{ maxHeight: '220px' }}
            >
              <rect x={pad} y={pad} width={palletWidth} height={palletLength} fill="none" stroke="#000" strokeWidth="3" />

              {/* Bearers (under the top boards - dashed) */}
              {bearers.map((y, i) => (
                <rect
                  key={`bearer-${i}`}
                  x={pad}
                  y={pad + y}
                  width={palletWidth}
                  height={bearerThickness}
                  fill="none"
                  stroke="#000"
                  strokeWidth="1"
                  strokeDasharray="8,4"
                />
              ))}

              {/* Top boards */}
              {topBoards.map((b, i) => (
                <rect
                  key={`board-${i}`}
                  x={pad + b.x}
                  y={pad}
                  width={b.w}
                  height={palletLength}
                  fill={b.isLeader ? '#eee' : 'none'}
                  stroke="#000"
                  strokeWidth="1.5"
                />
              ))}

              {/* Width dimension - top */}
              <line x1={pad} y1="35" x2={pad + palletWidth} y2="35" stroke="#000" strokeWidth="2" />
              <line x1={pad} y1="20" x2={pad} y2="50" stroke="#000" strokeWidth="2" />
              <line x1={pad + palletWidth} y1="20" x2={pad + palletWidth} y2="50" stroke="#000" strokeWidth="2" />
              <text x={pad + palletWidth/2} y="25" textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletWidth}</text>

              {/* Length dimension - right */}
              <line x1={pad + palletWidth + 35} y1={pad} x2={pad + palletWidth + 35} y2={pad + palletLength} stroke="#000" strokeWidth="2" />
              <line x1={pad + palletWidth + 20} y1={pad} x2={pad + palletWidth + 50} y2={pad} stroke="#000" strokeWidth="2" />
              <line x1={pad + palletWidth + 20} y1={pad + palletLength} x2={pad + palletWidth + 50} y2={pad + palletLength} stroke="#000" strokeWidth="2" />
              <text x={pad + palletWidth + 65} y={pad + palletLength/2} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold" transform={`rotate(90, ${pad + palletWidth + 65}, ${pad + palletLength/2})`}>{palletLength}</text>

              {/* Top gap dimension - between first two top boards */}
              {topBoards.length >= 2 && topGap > 0 && (() => {
                const x1 = pad + topBoards[0].x + topBoards[0].w
                const x2 = pad + topBoards[1].x
                const y = pad + palletLength
                return (
                  <>
                    <line x1={x1} y1={y + 30} x2={x2} y2={y + 30} stroke="#000" strokeWidth="2" />
                    <line x1={x1} y1={y + 15} x2={x1} y2={y + 45} stroke="#000" strokeWidth="2" />
                    <line x1={x2} y1={y + 15} x2={x2} y2={y + 45} stroke="#000" strokeWidth="2" />
                    <text x={(x1 + x2) / 2} y={y + 80} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold">{Math.round(topGap)}</text>
                  </>
                )
              })()}
            </svg>
          </div>

          {/* Front Elevation - looking along the length: deck boards end-on, front bearer full width */}
          <div className="diagram-box">
            <div className="diagram-label">Front elevation</div>
            <svg
              viewBox={`0 0 ${palletWidth + 180} ${palletHeight + 190}`}
              className="diagram-svg"
              style={{ maxHeight: '160px' }}
            >
              {/* Top boards (end grain) */}
              {topBoards.map((b, i) => (
                <rect key={`top-front-${i}`} x={pad + b.x} y={bearerTopY - b.t} width={b.w} height={b.t}
                  fill={b.isLeader ? '#eee' : 'none'} stroke="#000" strokeWidth="1.5" />
              ))}

              {/* Front bearer */}
              {numberOfBearers > 0 && (
                <rect x={pad} y={bearerTopY} width={palletWidth} height={bearerHeight} fill="none" stroke="#000" strokeWidth="1.5" />
              )}

              {/* Bottom boards (end grain) */}
              {bottomBoards.map((b, i) => (
                <rect key={`bottom-front-${i}`} x={pad + b.x} y={bearerBottomY} width={b.w} height={b.t}
                  fill={b.isLeader ? '#eee' : 'none'} stroke="#000" strokeWidth="1.5" />
              ))}

              {/* Width dimension */}
              <line x1={pad} y1={pad + palletHeight + 35} x2={pad + palletWidth} y2={pad + palletHeight + 35} stroke="#000" strokeWidth="2" />
              <line x1={pad} y1={pad + palletHeight + 20} x2={pad} y2={pad + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <line x1={pad + palletWidth} y1={pad + palletHeight + 20} x2={pad + palletWidth} y2={pad + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <text x={pad + palletWidth/2} y={pad + palletHeight + 90} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletWidth}</text>

              {/* Height dimension */}
              <line x1="35" y1={pad} x2="35" y2={pad + palletHeight} stroke="#000" strokeWidth="2" />
              <line x1="20" y1={pad} x2="50" y2={pad} stroke="#000" strokeWidth="2" />
              <line x1="20" y1={pad + palletHeight} x2="50" y2={pad + palletHeight} stroke="#000" strokeWidth="2" />
              <text x="25" y={pad + palletHeight/2} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold" transform={`rotate(-90, 25, ${pad + palletHeight/2})`}>{palletHeight}</text>
            </svg>
          </div>

          {/* Side Elevation - looking across the width: edge boards full length, bearers end-on */}
          <div className="diagram-box">
            <div className="diagram-label">Side elevation</div>
            <svg
              viewBox={`0 0 ${palletLength + 180} ${palletHeight + 190}`}
              className="diagram-svg"
              style={{ maxHeight: '160px' }}
            >
              {/* Edge top board */}
              {topBoards.length > 0 && (
                <rect x={pad} y={bearerTopY - topBoards[0].t} width={palletLength} height={topBoards[0].t} fill="none" stroke="#000" strokeWidth="1.5" />
              )}

              {/* Bearers (end-on) */}
              {bearers.map((z, i) => (
                <rect key={`bearer-side-${i}`} x={pad + z} y={bearerTopY} width={bearerThickness} height={bearerHeight}
                  fill="none" stroke="#000" strokeWidth="1.5" />
              ))}

              {/* Edge bottom board */}
              {bottomBoards.length > 0 && (
                <rect x={pad} y={bearerBottomY} width={palletLength} height={bottomBoards[0].t} fill="none" stroke="#000" strokeWidth="1.5" />
              )}

              {/* Length dimension */}
              <line x1={pad} y1={pad + palletHeight + 35} x2={pad + palletLength} y2={pad + palletHeight + 35} stroke="#000" strokeWidth="2" />
              <line x1={pad} y1={pad + palletHeight + 20} x2={pad} y2={pad + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <line x1={pad + palletLength} y1={pad + palletHeight + 20} x2={pad + palletLength} y2={pad + palletHeight + 50} stroke="#000" strokeWidth="2" />
              <text x={pad + palletLength/2} y={pad + palletHeight + 90} textAnchor="middle" fontSize={dimFontSize} fontFamily="Arial" fontWeight="bold">{palletLength}</text>

              {/* Height dimension */}
              <line x1={pad + palletLength + 35} y1={pad} x2={pad + palletLength + 35} y2={pad + palletHeight} stroke="#000" strokeWidth="2" />
              <line x1={pad + palletLength + 20} y1={pad} x2={pad + palletLength + 50} y2={pad} stroke="#000" strokeWidth="2" />
              <line x1={pad + palletLength + 20} y1={pad + palletHeight} x2={pad + palletLength + 50} y2={pad + palletHeight} stroke="#000" strokeWidth="2" />
              <text x={pad + palletLength + 65} y={pad + palletHeight/2} textAnchor="middle" fontSize={dimFontSizeSmall} fontFamily="Arial" fontWeight="bold" transform={`rotate(90, ${pad + palletLength + 65}, ${pad + palletHeight/2})`}>{palletHeight}</text>
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
      )}

      {/* Quote Summary */}
      <div className="quote-section">
        <table className="quote-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Material</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Length</th>
              <th>$/m</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([item, material, size, qty, length, rate, amount]) => (
              <tr key={item}>
                <td>{item}</td>
                <td>{material}</td>
                <td>{size}</td>
                <td>{qty}</td>
                <td>{metres(length)}</td>
                <td>{(Number(rate) || 0).toFixed(2)}</td>
                <td className="amount-col">{money(amount)}</td>
              </tr>
            ))}
            {totalNails > 0 && (
              <tr>
                <td>Nails</td>
                <td>—</td>
                <td>—</td>
                <td>{totalNails}</td>
                <td>—</td>
                <td>{(Number(pricePerNail) || 0).toFixed(2)} ea</td>
                <td className="amount-col">{money(nailsTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals - aligned right, no borders */}
        <div className="totals-section">
          <div className="total-line">
            <span className="total-label">Per Pallet</span>
            <span className="total-value">{money(totalPrice)}</span>
          </div>
          {quantity > 1 && (
            <div className="total-line qty-line">
              <span className="total-label">× {quantity} pallets</span>
              <span className="total-value"></span>
            </div>
          )}
          <div className="total-line grand-total">
            <span className="total-label">Total</span>
            <span className="total-value">{money(grandTotal)}</span>
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
