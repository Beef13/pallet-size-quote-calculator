import { describe, it, expect } from 'vitest'
import {
  timberCost, deckBoardsWidth, deckGapSize, maxDeckBoards, costStack, orderTotals, formatCurrency
} from './calculations'
import timberData from '../data/timber-prices.json'

// Default price per metre for a size, straight from the shipped price list
const rate = (kind, dimensions) => {
  const type = timberData.timberTypes.find(t => t.id === 'pine-green-case')
  const size = (kind === 'board' ? type.boardSizes : type.bearerSizes).find(s => s.dimensions.replace(/\s|mm/g, '') === dimensions)
  return kind === 'board' ? size.pricePerBoard : size.pricePerBearer
}

describe('timberCost: price per metre x real length x count', () => {
  it('prices three 1165 mm boards at $0.75 a metre', () => {
    expect(timberCost(0.75, 1165, 3)).toBe(2.62)
  })
  it('scales with length', () => {
    expect(timberCost(1, 2000, 1)).toBe(2)
    expect(timberCost(1, 500, 4)).toBe(2)
  })
  it('rounds to cents', () => {
    expect(timberCost(0.62, 1165, 7)).toBe(5.06)
  })
  it('treats blank or bad input as zero rather than NaN', () => {
    expect(timberCost('', 1165, 3)).toBe(0)
    expect(timberCost(0.75, undefined, 3)).toBe(0)
    expect(timberCost(0.75, 1165, 'x')).toBe(0)
    expect(timberCost('0.75', '1165', '3')).toBe(2.62)
  })
})

describe('deck layout', () => {
  it('adds up board widths, with wider leaders on the two outside edges', () => {
    expect(deckBoardsWidth(7, 100)).toBe(700)
    expect(deckBoardsWidth(7, 100, 150)).toBe(800)
    expect(deckBoardsWidth(1, 100, 150)).toBe(100)
    expect(deckBoardsWidth(0, 100)).toBe(0)
  })
  it('spreads the leftover width evenly between boards', () => {
    expect(deckGapSize(1165, 7, 100)).toBeCloseTo(77.5, 5)
    expect(deckGapSize(1165, 7, 100, 150)).toBeCloseTo(60.83, 2)
    expect(deckGapSize(1165, 3, 100)).toBeCloseTo(432.5, 5)
  })
  it('has no gap for a single board and goes negative when boards do not fit', () => {
    expect(deckGapSize(1165, 1, 100)).toBe(0)
    expect(deckGapSize(1165, 12, 100)).toBeLessThan(0)
  })
  it('never allows more boards than fit across the pallet', () => {
    expect(maxDeckBoards(1165, 100)).toBe(11)
    expect(maxDeckBoards(1165, 100, 150)).toBe(10)
    expect(maxDeckBoards(1165, 150)).toBe(7)
    expect(maxDeckBoards(50, 100)).toBe(1)
  })
})

describe('costStack: materials -> labour -> markup', () => {
  it('adds labour, then markup on cost', () => {
    const s = costStack(12.92, { labourPerPallet: 3, markupPercent: 25 })
    expect(s.costPerPallet).toBe(15.92)
    expect(s.markupPerPallet).toBe(3.98)
    expect(s.sellPerPallet).toBe(19.9)
    expect(s.marginPercent).toBeCloseTo(20, 1)
  })
  it('a 25% markup is a 20% margin; a 100% markup is a 50% margin', () => {
    expect(costStack(100, { markupPercent: 25 }).marginPercent).toBeCloseTo(20, 5)
    expect(costStack(100, { markupPercent: 100 }).marginPercent).toBeCloseTo(50, 5)
  })
  it('with no labour or markup the price is just the materials', () => {
    const s = costStack(12.92, {})
    expect(s.sellPerPallet).toBe(12.92)
    expect(s.markupPerPallet).toBe(0)
    expect(s.marginPercent).toBe(0)
  })
  it('does not charge labour for an empty pallet', () => {
    expect(costStack(0, { labourPerPallet: 3, markupPercent: 25 }).sellPerPallet).toBe(0)
  })
  it('the parts always add up to the price', () => {
    for (const materials of [0.01, 7.77, 12.92, 14.64, 99.99]) {
      for (const markup of [0, 12.5, 25, 33.3]) {
        const s = costStack(materials, { labourPerPallet: 2.35, markupPercent: markup })
        expect(s.costPerPallet + s.markupPerPallet).toBeCloseTo(s.sellPerPallet, 10)
      }
    }
  })
})

describe('costStack: markup as a dollar amount per pallet', () => {
  it('adds the set amount to cost', () => {
    const s = costStack(12.92, { labourPerPallet: 3, markupType: 'amount', markupAmount: 5 })
    expect(s.costPerPallet).toBe(15.92)
    expect(s.markupPerPallet).toBe(5)
    expect(s.sellPerPallet).toBe(20.92)
    expect(s.markupType).toBe('amount')
    expect(s.markupSet).toBe(true)
  })
  it('reports the amount as a percentage of cost and as a margin', () => {
    const s = costStack(20, { markupType: 'amount', markupAmount: 5 })
    expect(s.markupPercent).toBeCloseTo(25, 5)
    expect(s.marginPercent).toBeCloseTo(20, 5)
  })
  it('ignores the percentage while the amount is in use, and the amount while the percentage is', () => {
    expect(costStack(100, { markupType: 'amount', markupAmount: 7, markupPercent: 50 }).sellPerPallet).toBe(107)
    expect(costStack(100, { markupType: 'percent', markupAmount: 7, markupPercent: 50 }).sellPerPallet).toBe(150)
    expect(costStack(100, { markupAmount: 7, markupPercent: 50 }).sellPerPallet).toBe(150)
  })
  it('charges nothing until there is a pallet to build', () => {
    const s = costStack(0, { labourPerPallet: 3, markupType: 'amount', markupAmount: 5 })
    expect(s.sellPerPallet).toBe(0)
    expect(s.markupSet).toBe(true)
  })
  it('treats a blank or negative amount as no markup', () => {
    expect(costStack(50, { markupType: 'amount', markupAmount: '' }).sellPerPallet).toBe(50)
    expect(costStack(50, { markupType: 'amount', markupAmount: -4 }).sellPerPallet).toBe(50)
    expect(costStack(50, { markupType: 'amount', markupAmount: 0 }).markupSet).toBe(false)
  })
  it('rounds to cents so cost plus markup is the price', () => {
    const s = costStack(13.337, { labourPerPallet: 2.35, markupType: 'amount', markupAmount: 4.999 })
    expect(s.markupPerPallet).toBe(5)
    expect(s.costPerPallet + s.markupPerPallet).toBeCloseTo(s.sellPerPallet, 10)
  })
})

describe('orderTotals: quantity and GST', () => {
  it('multiplies by quantity and adds 10% GST', () => {
    expect(orderTotals(19.9, 250, 10, true)).toEqual({ exGst: 4975, gst: 497.5, grand: 5472.5 })
  })
  it('leaves GST off when it is switched off', () => {
    expect(orderTotals(19.9, 250, 10, false)).toEqual({ exGst: 4975, gst: 0, grand: 4975 })
  })
  it('rounds GST to cents', () => {
    expect(orderTotals(22.05, 1, 10, true)).toEqual({ exGst: 22.05, gst: 2.21, grand: 24.26 })
  })
  it('handles a single pallet and a zero price', () => {
    expect(orderTotals(0, 5, 10, true)).toEqual({ exGst: 0, gst: 0, grand: 0 })
  })
})

describe('a full quote, end to end, at the default price list', () => {
  it('1165 x 1165, 3 bottom + 7 top boards, 3 bearers, $3 labour, 25% markup, 250 pallets', () => {
    const bottom = timberCost(rate('board', '100x19'), 1165, 3)
    const top = timberCost(rate('board', '100x17'), 1165, 7)
    const bearers = timberCost(rate('bearer', '100x38'), 1165, 3)
    expect([bottom, top, bearers]).toEqual([2.62, 5.06, 5.24])
    const materials = Math.round((bottom + top + bearers) * 100) / 100
    expect(materials).toBe(12.92)
    const stack = costStack(materials, { labourPerPallet: 3, markupPercent: 25 })
    expect(stack.sellPerPallet).toBe(19.9)
    expect(orderTotals(stack.sellPerPallet, 250, 10, true)).toEqual({ exGst: 4975, gst: 497.5, grand: 5472.5 })
  })
})

describe('formatCurrency', () => {
  it('uses thousands separators and always two decimals', () => {
    expect(formatCurrency(4975)).toBe('$4,975.00')
    expect(formatCurrency(12.9)).toBe('$12.90')
    expect(formatCurrency(undefined)).toBe('$0.00')
  })
})
