import { pricingConfig } from '../config/pricing.config.js'
import { AppError } from '../middleware/errorHandler.js'

/**
 * Calculate liters from amount
 * @param {number} amount - Amount in currency
 * @param {number} pricePerLiter - Price per liter (optional, defaults to config)
 * @returns {number} Liters (rounded based on rounding strategy)
 */
export function calculateLiters(amount, pricePerLiter = null) {
  const price = pricePerLiter || pricingConfig.pricePerLiter
  
  if (amount <= 0 || price <= 0) {
    throw new AppError('Amount and price must be positive numbers', 400)
  }

  const exactLiters = amount / price

  // Apply rounding strategy
  switch (pricingConfig.roundingStrategy) {
    case 'up':
      return Math.ceil(exactLiters)
    case 'down':
      return Math.floor(exactLiters)
    case 'nearest':
    default:
      return Math.round(exactLiters)
  }
}

/**
 * Calculate amount from liters
 * @param {number} liters - Number of liters
 * @param {number} pricePerLiter - Price per liter (optional, defaults to config)
 * @returns {number} Amount in currency
 */
export function calculateAmount(liters, pricePerLiter = null) {
  const price = pricePerLiter || pricingConfig.pricePerLiter
  
  if (liters <= 0 || price <= 0) {
    throw new AppError('Liters and price must be positive numbers', 400)
  }

  return liters * price
}

/**
 * Get payment preview with adjusted amounts
 * Shows user what they will actually get after rounding
 * 
 * @param {number} amount - Amount entered by user
 * @param {number} pricePerLiter - Price per liter (optional, defaults to config)
 * @returns {Object} Preview with adjusted amount, liters, and pricing info
 */
export function getPaymentPreview(amount, pricePerLiter = null) {
  const price = pricePerLiter || pricingConfig.pricePerLiter

  // Validate amount range
  if (amount < pricingConfig.minAmount) {
    throw new AppError(
      `Amount must be at least ${pricingConfig.minAmount} ${pricingConfig.currency}`,
      400
    )
  }

  if (amount > pricingConfig.maxAmount) {
    throw new AppError(
      `Amount cannot exceed ${pricingConfig.maxAmount} ${pricingConfig.currency}`,
      400
    )
  }

  // Calculate liters (with rounding)
  const liters = calculateLiters(amount, price)
  
  // Calculate adjusted amount (actual amount user will pay)
  const adjustedAmount = calculateAmount(liters, price)

  return {
    requestedAmount: amount,
    amount: adjustedAmount,
    liters,
    pricePerLiter: price,
    currency: pricingConfig.currency,
    roundingStrategy: pricingConfig.roundingStrategy,
    difference: adjustedAmount - amount,
  }
}

/**
 * Validate amount for payment
 * @param {number} amount - Amount to validate
 * @returns {Object} Validation result with errors if any
 */
export function validatePaymentAmount(amount) {
  const errors = []

  // Check if amount is a number
  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number')
  }

  // Check if amount is positive
  if (amount <= 0) {
    errors.push('Amount must be greater than 0')
  }

  // Check minimum amount
  if (amount < pricingConfig.minAmount) {
    errors.push(`Amount must be at least ${pricingConfig.minAmount} ${pricingConfig.currency}`)
  }

  // Check maximum amount
  if (amount > pricingConfig.maxAmount) {
    errors.push(`Amount cannot exceed ${pricingConfig.maxAmount} ${pricingConfig.currency}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format amount for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (optional, defaults to config)
 * @returns {string} Formatted amount string
 */
export function formatAmount(amount, currency = null) {
  const curr = currency || pricingConfig.currency
  return `${amount.toFixed(2)} ${curr}`
}

/**
 * Format liters for display
 * @param {number} liters - Liters to format
 * @returns {string} Formatted liters string
 */
export function formatLiters(liters) {
  return `${liters} L`
}

/**
 * Get pricing info summary
 * @returns {Object} Pricing information
 */
export function getPricingInfo() {
  return {
    pricePerLiter: pricingConfig.pricePerLiter,
    currency: pricingConfig.currency,
    minAmount: pricingConfig.minAmount,
    maxAmount: pricingConfig.maxAmount,
    minLiters: calculateLiters(pricingConfig.minAmount),
    maxLiters: calculateLiters(pricingConfig.maxAmount),
    roundingStrategy: pricingConfig.roundingStrategy,
  }
}
