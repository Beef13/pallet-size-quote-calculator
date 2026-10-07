/**
 * Calculate the gap size between boards for even distribution
 * Boards are flush with pallet edges (no gaps at ends)
 * @param {number} palletWidth - Total width of the pallet in mm
 * @param {number} boardWidth - Width of a single board in mm
 * @param {number} numberOfBoards - Number of boards to place
 * @returns {number} Gap size in mm (rounded to 2 decimal places)
 */
export function calculateGapSize(palletWidth, boardWidth, numberOfBoards) {
  const totalBoardWidth = boardWidth * numberOfBoards;
  const availableSpace = palletWidth - totalBoardWidth;
  const numberOfGaps = numberOfBoards - 1; // Only gaps between boards (flush edges)
  
  // Handle edge case of single board (no gaps)
  if (numberOfGaps <= 0) {
    return 0;
  }
  
  const gapSize = availableSpace / numberOfGaps;
  
  return Math.round(gapSize * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate the total price for the quote
 * @param {number} pricePerBoard - Price per individual board
 * @param {number} numberOfBoards - Number of boards
 * @returns {string} Total price formatted to 2 decimal places
 */
export function calculateTotalPrice(pricePerBoard, numberOfBoards) {
  const total = pricePerBoard * numberOfBoards;
  return total.toFixed(2);
}

/**
 * Validate inputs before calculation
 * @param {number} palletWidth - Total width of the pallet
 * @param {number} boardWidth - Width of a single board
 * @param {number} numberOfBoards - Number of boards
 * @returns {Object} Validation result with valid flag and optional error message
 */
export function validateInputs(palletWidth, boardWidth, numberOfBoards) {
  // Check if values are positive
  if (palletWidth <= 0) {
    return {
      valid: false,
      error: "Pallet width must be greater than 0"
    };
  }

  if (numberOfBoards <= 0) {
    return {
      valid: false,
      error: "Number of boards must be greater than 0"
    };
  }

  // Check if boards fit on the pallet
  const totalBoardWidth = boardWidth * numberOfBoards;
  
  if (totalBoardWidth >= palletWidth) {
    return {
      valid: false,
      error: "Boards are too wide for the pallet. Reduce the number of boards or increase pallet width."
    };
  }

  // Check if gap size is reasonable (minimum 5mm for practical purposes)
  const gapSize = calculateGapSize(palletWidth, boardWidth, numberOfBoards);
  
  if (gapSize < 5) {
    return {
      valid: false,
      error: "Gap size is too small (minimum 5mm recommended). Reduce boards or increase pallet width."
    };
  }

  return { valid: true };
}

/**
 * Width taken up by a deck of boards. When custom leader (edge) boards are
 * used and there are at least 2 boards, the two outside boards are leaders.
 * @param {number} numberOfBoards
 * @param {number} boardWidth - width of the inner boards (mm)
 * @param {number|null} leaderWidth - width of the leader boards (mm) or null for none
 */
export function deckBoardsWidth(numberOfBoards, boardWidth, leaderWidth = null) {
  if (numberOfBoards <= 0) return 0
  if (leaderWidth && numberOfBoards >= 2) {
    return 2 * leaderWidth + (numberOfBoards - 2) * boardWidth
  }
  return numberOfBoards * boardWidth
}

/**
 * Gap between boards (boards flush with both pallet edges).
 * Can be negative when the boards don't fit - callers should check.
 */
export function deckGapSize(palletWidth, numberOfBoards, boardWidth, leaderWidth = null) {
  if (numberOfBoards <= 1) return 0
  return (palletWidth - deckBoardsWidth(numberOfBoards, boardWidth, leaderWidth)) / (numberOfBoards - 1)
}

/**
 * Maximum number of boards (capped) that fit across the pallet without overlapping.
 */
export function maxDeckBoards(palletWidth, boardWidth, leaderWidth = null, cap = 15) {
  if (!boardWidth || !palletWidth) return cap
  let max = 0
  for (let n = 1; n <= cap; n++) {
    if (deckBoardsWidth(n, boardWidth, leaderWidth) <= palletWidth) max = n
    else break
  }
  return Math.max(1, max)
}

/**
 * Price of timber sold per lineal metre.
 * @param {number} pricePerMetre
 * @param {number} lengthMm - length of each piece in mm
 * @param {number} quantity
 * @returns {number} rounded to cents
 */
export function timberCost(pricePerMetre, lengthMm, quantity) {
  const price = Number(pricePerMetre) || 0
  const metres = (Number(lengthMm) || 0) / 1000
  const count = Number(quantity) || 0
  return Math.round(price * metres * count * 100) / 100
}

/**
 * Format currency value
 * @param {number} value - Numeric value to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
  const n = Number(value) || 0;
  // Thousands separators, always two decimals: $12,345.60
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format dimension value
 * @param {number} value - Numeric value to format
 * @returns {string} Formatted dimension string with unit
 */
export function formatDimension(value) {
  return `${Math.round(parseFloat(value))}mm`;
}


const round2 = (v) => Math.round(v * 100) / 100

/**
 * Build the price of one pallet from its material cost.
 *   cost  = materials + labour
 *   sell  = cost + markup
 *   margin% = markup / sell
 * Markup is either a percentage of cost (markupType 'percent', the default) or a set dollar
 * amount per pallet (markupType 'amount'). Either way `markupPercent` comes back as the markup
 * as a percentage of cost, so the two can be compared.
 * Each step is rounded to cents, so the figures shown always add up.
 * @param {number} materialsTotal - timber and nails for one pallet
 * @param {{labourPerPallet?: number, markupPercent?: number, markupType?: string, markupAmount?: number}} pricing
 * @param {boolean} hasMaterials - labour and a dollar markup are only charged once there is something to build
 */
export function costStack(materialsTotal, pricing = {}, hasMaterials = materialsTotal > 0) {
  const labourPerPallet = hasMaterials ? round2(Number(pricing.labourPerPallet) || 0) : 0
  const costPerPallet = round2((Number(materialsTotal) || 0) + labourPerPallet)
  const markupType = pricing.markupType === 'amount' ? 'amount' : 'percent'
  let markupPercent, markupPerPallet, markupSet
  if (markupType === 'amount') {
    const amount = Math.max(0, round2(Number(pricing.markupAmount) || 0))
    markupSet = amount > 0
    markupPerPallet = hasMaterials && costPerPallet > 0 ? amount : 0
    markupPercent = costPerPallet > 0 ? (markupPerPallet / costPerPallet) * 100 : 0
  } else {
    markupPercent = Math.max(0, Number(pricing.markupPercent) || 0)
    markupSet = markupPercent > 0
    markupPerPallet = round2(costPerPallet * markupPercent / 100)
  }
  const sellPerPallet = round2(costPerPallet + markupPerPallet)
  const marginPercent = sellPerPallet > 0 ? (markupPerPallet / sellPerPallet) * 100 : 0
  return { labourPerPallet, costPerPallet, markupType, markupSet, markupPercent, markupPerPallet, sellPerPallet, marginPercent }
}

/**
 * Totals for the whole order.
 * @param {number} sellPerPallet - price of one pallet, ex GST
 * @param {number} quantity
 * @param {number} gstRate - percent, e.g. 10
 * @param {boolean} showGst - false leaves GST off the quote
 */
export function orderTotals(sellPerPallet, quantity, gstRate = 10, showGst = true) {
  const exGst = round2((Number(sellPerPallet) || 0) * (Number(quantity) || 0))
  const gst = showGst ? Math.round(exGst * (Number(gstRate) || 0)) / 100 : 0
  return { exGst, gst, grand: round2(exGst + gst) }
}
