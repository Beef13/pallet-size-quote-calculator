import React from 'react'
import '../styles/PrintableQuote.css'
import { formatCurrency } from '../utils/calculations'
import ShopDrawing from './ShopDrawing'

const money = (v) => formatCurrency(v)
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

  const hasDimensions = palletWidth > 0 && palletLength > 0

  const today = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  // Table rows - only items that are actually on the pallet.
  // Each gets a letter that tags the same part on the drawings.
  const rows = []
  if (topBoardSize && topInnerBoards > 0) rows.push(['top', 'Top boards', topBoardTimberType, topBoardSize, topInnerBoards, boardLength, pricePerTopBoard, topBoardsTotal])
  if (topLeaderCount > 0) rows.push(['topLeader', 'Top leader boards', topLeaderTimberType, topLeaderSize, topLeaderCount, boardLength, pricePerTopLeader, topLeadersTotal])
  if (bearerSize && numberOfBearers > 0) rows.push(['bearer', 'Bearers', bearerTimberType, bearerSize, numberOfBearers, bearerLength, pricePerBearer, bearersTotal])
  if (bottomBoardSize && bottomInnerBoards > 0) rows.push(['bottom', 'Bottom boards', bottomBoardTimberType, bottomBoardSize, bottomInnerBoards, boardLength, pricePerBottomBoard, bottomBoardsTotal])
  if (bottomLeaderCount > 0) rows.push(['bottomLeader', 'Bottom leader boards', bottomLeaderTimberType, bottomLeaderSize, bottomLeaderCount, boardLength, pricePerBottomLeader, bottomLeadersTotal])
  const parts = rows.map(([kind, , material], i) => ({ kind, material, ref: String.fromCharCode(65 + i) }))

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

      {/* Shop drawing */}
      {hasDimensions && (
        <div className="diagram-section">
          <ShopDrawing q={quoteData} quantity={quantity} today={today} parts={parts} />
        </div>
      )}

      {/* Quote Summary */}
      <div className="quote-section">
        <table className="quote-table">
          <thead>
            <tr>
              <th className="ref-col">Ref</th>
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
            {rows.map(([kind, item, material, size, qty, length, rate, amount], i) => (
              <tr key={kind}>
                <td className="ref-col"><span className="ref-tag">{parts[i].ref}</span></td>
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
                <td className="ref-col"></td>
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
