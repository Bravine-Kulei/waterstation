import dotenv from 'dotenv'

dotenv.config()

/**
 * Water Pricing Configuration
 * All pricing-related settings loaded from environment variables
 */
export const pricingConfig = {
  // Price per liter
  pricePerLiter: parseFloat(process.env.PRICE_PER_LITER || '5'),
  
  // Currency
  currency: process.env.CURRENCY || 'KES',
  
  // Minimum and maximum amounts
  minAmount: parseFloat(process.env.MIN_AMOUNT || '5'), // Minimum 5 KES (1 liter)
  maxAmount: parseFloat(process.env.MAX_AMOUNT || '70000'), // Maximum 70,000 KES
  
  // Rounding strategy: 'nearest', 'up', 'down'
  roundingStrategy: process.env.ROUNDING_STRATEGY || 'nearest',
}

/**
 * Validate pricing configuration
 * @throws {Error} If configuration is invalid
 */
export function validatePricingConfig() {
  // Validate price per liter
  if (isNaN(pricingConfig.pricePerLiter) || pricingConfig.pricePerLiter <= 0) {
    throw new Error('PRICE_PER_LITER must be a positive number')
  }

  // Validate minimum amount
  if (isNaN(pricingConfig.minAmount) || pricingConfig.minAmount < 0) {
    throw new Error('MIN_AMOUNT must be a non-negative number')
  }

  // Validate maximum amount
  if (isNaN(pricingConfig.maxAmount) || pricingConfig.maxAmount <= 0) {
    throw new Error('MAX_AMOUNT must be a positive number')
  }

  // Validate min < max
  if (pricingConfig.minAmount >= pricingConfig.maxAmount) {
    throw new Error('MIN_AMOUNT must be less than MAX_AMOUNT')
  }

  // Validate rounding strategy
  const validStrategies = ['nearest', 'up', 'down']
  if (!validStrategies.includes(pricingConfig.roundingStrategy)) {
    throw new Error(`ROUNDING_STRATEGY must be one of: ${validStrategies.join(', ')}`)
  }
}

/**
 * Get pricing summary
 * @returns {Object} Pricing configuration summary
 */
export function getPricingSummary() {
  return {
    pricePerLiter: pricingConfig.pricePerLiter,
    currency: pricingConfig.currency,
    minAmount: pricingConfig.minAmount,
    maxAmount: pricingConfig.maxAmount,
    minLiters: Math.ceil(pricingConfig.minAmount / pricingConfig.pricePerLiter),
    maxLiters: Math.floor(pricingConfig.maxAmount / pricingConfig.pricePerLiter),
    roundingStrategy: pricingConfig.roundingStrategy,
  }
}
