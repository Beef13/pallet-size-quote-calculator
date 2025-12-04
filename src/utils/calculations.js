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
 * Format currency value
 * @param {number} value - Numeric value to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
  return `$${parseFloat(value).toFixed(2)}`;
}

/**
 * Format dimension value
 * @param {number} value - Numeric value to format
 * @returns {string} Formatted dimension string with unit
 */
export function formatDimension(value) {
  return `${parseFloat(value).toFixed(2)}mm`;
}

