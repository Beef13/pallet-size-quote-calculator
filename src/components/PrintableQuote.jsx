import React from 'react'
import '../styles/PrintableQuote.css'
import { formatCurrency } from '../utils/calculations'
import ShopDrawing from './ShopDrawing'

const money = (v) => formatCurrency(v)
const metres = (mm) => `${((Number(mm) || 0) / 1000).toFixed(3)} m`

// variant: 'customer' - drawings, specification and total price only
//          'breakdown' - full cost breakdown for the business's own records
function PrintableQuote({ quoteData, quantity = 1, variant = 'breakdown', quoteRef = '', totals, business = {}, customer = {} }) {
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

  const isCustomer = variant === 'customer'
  const sizeLabel = (size) => (size || '').replace('x', ' × ')

  const t = totals || { exGst: grandTotal, gst: 0, grand: grandTotal }
  const showGst = quoteData.showGst !== false
  const validDays = Math.max(1, parseInt(business.validDays) || 30)
  const validUntil = new Date(Date.now() + validDays * 86400000).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const contact = [business.phone, business.email].filter(Boolean)

  const header = (
    <>
      {isCustomer && (business.logo || business.name || business.abn || contact.length > 0 || business.address) && (
        <div className="print-business">
          <div className="print-business-left">
            {business.logo && <img className="print-logo" src={business.logo} alt="" />}
            <div>
              {business.name && <strong>{business.name}</strong>}
              {business.address && <span>{business.address}</span>}
            </div>
          </div>
          <div className="print-business-right">
            {contact.map(c => <span key={c}>{c}</span>)}
            {business.abn && <span>ABN {business.abn}</span>}
          </div>
        </div>
      )}
      <div className="print-header">
        <h1>{isCustomer ? 'Quote' : 'Cost breakdown'}{quoteRef ? ` ${quoteRef}` : ''}</h1>
        <div className="print-meta">
          <span>Date: {today}</span>
          {isCustomer && <span>Valid until: {validUntil}</span>}
          <span>Qty: {quantity}</span>
        </div>
      </div>
      {(customer.name || customer.ref) && (
        <div className="print-customer">
          {customer.name && <span><b>Prepared for:</b> {customer.name}</span>}
          {customer.ref && <span><b>Your reference:</b> {customer.ref}</span>}
        </div>
      )}
    </>
  )

  const drawing = hasDimensions && (
    <div className="diagram-section">
      <ShopDrawing q={quoteData} quantity={quantity} today={today} parts={parts} />
    </div>
  )

  return (
    <div className={`printable-quote ${isCustomer ? 'customer' : 'breakdown'}`}>
      {header}
      {drawing}

      {isCustomer ? (
        <div className="quote-section">
          {/* Specification: what the customer gets, no internal costs */}
          <table className="quote-table spec-table">
            <thead>
              <tr>
                <th className="ref-col">Ref</th>
                <th>Component</th>
                <th>Material</th>
                <th>Section (mm)</th>
                <th>Length</th>
                <th>Qty per pallet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([kind, item, material, size, qty, length], i) => (
                <tr key={kind}>
                  <td className="ref-col"><span className="ref-tag">{parts[i].ref}</span></td>
                  <td>{item}</td>
                  <td>{material}</td>
                  <td>{sizeLabel(size).replace('mm', '')}</td>
                  <td>{Math.round(length)} mm</td>
                  <td>{qty}</td>
                </tr>
              ))}
              {totalNails > 0 && (
                <tr>
                  <td className="ref-col"></td>
                  <td>Nails</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{totalNails}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="totals-section">
            <div className="total-line">
              <span className="total-label">Price per pallet{showGst ? ' (ex GST)' : ''}</span>
              <span className="total-value">{money(totalPrice)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">Quantity</span>
              <span className="total-value">{quantity}</span>
            </div>
            {showGst && (
              <>
                <div className="total-line">
                  <span className="total-label">Subtotal (ex GST)</span>
                  <span className="total-value">{money(t.exGst)}</span>
                </div>
                <div className="total-line">
                  <span className="total-label">GST {quoteData.gstRate}%</span>
                  <span className="total-value">{money(t.gst)}</span>
                </div>
              </>
            )}
            <div className="total-line grand-total">
              <span className="total-label">{showGst ? 'Total (inc GST)' : 'Total'}</span>
              <span className="total-value">{money(t.grand)}</span>
            </div>
          </div>
        </div>
      ) : (
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

          <div className="totals-section">
            <div className="total-line">
              <span className="total-label">Materials per pallet</span>
              <span className="total-value">{money(quoteData.materialsTotal)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">Labour per pallet</span>
              <span className="total-value">{money(quoteData.labourPerPallet)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">Cost per pallet</span>
              <span className="total-value">{money(quoteData.costPerPallet)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">Markup{quoteData.markupType === 'amount' ? ' per pallet' : ` ${Math.round(quoteData.markupPercent * 10) / 10}%`} ({Math.round(quoteData.marginPercent * 10) / 10}% margin)</span>
              <span className="total-value">{money(quoteData.markupPerPallet)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">Price per pallet{showGst ? ' (ex GST)' : ''}</span>
              <span className="total-value">{money(totalPrice)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">× {quantity} pallet{quantity === 1 ? '' : 's'}{showGst ? ' (ex GST)' : ''}</span>
              <span className="total-value">{money(t.exGst)}</span>
            </div>
            {showGst && (
              <div className="total-line">
                <span className="total-label">GST {quoteData.gstRate}%</span>
                <span className="total-value">{money(t.gst)}</span>
              </div>
            )}
            <div className="total-line grand-total">
              <span className="total-label">{showGst ? 'Total (inc GST)' : 'Total'}</span>
              <span className="total-value">{money(t.grand)}</span>
            </div>
            <div className="total-line">
              <span className="total-label">Gross profit on this quote</span>
              <span className="total-value">{money(quoteData.markupPerPallet * quantity)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="print-footer">
        {isCustomer ? `Quote valid for ${validDays} days, until ${validUntil}.` : `Internal record – not for customers. Rates as used on ${today}.`}
      </div>
    </div>
  )
}

export default PrintableQuote
