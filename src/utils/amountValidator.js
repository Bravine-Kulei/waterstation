/**
 * Validate payment amount
 * @param {number|string} amount - Amount to validate
 * @param {number} minAmount - Minimum allowed amount (default: 1)
 * @param {number} maxAmount - Maximum allowed amount (default: 70000)
 * @returns {Object} { valid: boolean, normalized: number, error: string }
 */
export function validateAmount(amount, minAmount = 1, maxAmount = 70000) {
  if (amount === null || amount === undefined || amount === '') {
    return {
      valid: false,
      normalized: null,
      error: 'Amount is required',
    };
  }

  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);

  // Check if it's a valid number
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return {
      valid: false,
      normalized: null,
      error: 'Amount must be a valid number',
    };
  }

  // Check if it's positive
  if (numAmount <= 0) {
    return {
      valid: false,
      normalized: null,
      error: 'Amount must be greater than 0',
    };
  }

  // Check minimum amount
  if (numAmount < minAmount) {
    return {
      valid: false,
      normalized: null,
      error: `Amount must be at least ${minAmount}`,
    };
  }

  // Check maximum amount (M-Pesa limit is typically 70,000)
  if (numAmount > maxAmount) {
    return {
      valid: false,
      normalized: null,
      error: `Amount cannot exceed ${maxAmount}`,
    };
  }

  // Round to 2 decimal places
  const normalized = Math.round(numAmount * 100) / 100;

  return {
    valid: true,
    normalized,
    error: null,
  };
}
