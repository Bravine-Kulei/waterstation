import dotenv from 'dotenv'

dotenv.config()

/**
 * Daraja API (M-Pesa) Configuration
 * All M-Pesa/Daraja-related settings loaded from environment variables
 * 
 * Documentation: https://developer.safaricom.co.ke/
 */
export const darajaConfig = {
  // API Credentials
  consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
  passkey: process.env.DARAJA_PASSKEY || '',
  
  // Business Configuration
  shortcode: process.env.DARAJA_SHORTCODE || '174379', // Till Number
  
  // API Endpoints
  environment: process.env.DARAJA_ENVIRONMENT || 'sandbox',
  baseUrl: process.env.DARAJA_ENVIRONMENT === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke',
  
  // Callback URLs
  callbackUrl: process.env.DARAJA_CALLBACK_URL || '',
  
  // Timeouts (in milliseconds)
  tokenCacheDuration: parseInt(process.env.DARAJA_TOKEN_CACHE_DURATION || '3300000', 10), // 55 minutes
  requestTimeout: parseInt(process.env.DARAJA_REQUEST_TIMEOUT || '30000', 10), // 30 seconds
}

/**
 * Validate required Daraja configuration
 * @throws {Error} If required configuration is missing
 */
export function validateDarajaConfig() {
  const required = ['consumerKey', 'consumerSecret', 'passkey', 'shortcode', 'callbackUrl']
  const missing = required.filter((key) => !darajaConfig[key])

  if (missing.length > 0) {
    throw new Error(`Missing required Daraja configuration: ${missing.join(', ')}`)
  }

  // Validate environment
  if (darajaConfig.environment && !['sandbox', 'production'].includes(darajaConfig.environment)) {
    throw new Error('DARAJA_ENVIRONMENT must be either "sandbox" or "production"')
  }

  // Validate shortcode format (should be numeric)
  if (!/^\d+$/.test(darajaConfig.shortcode)) {
    throw new Error('DARAJA_SHORTCODE must be a numeric value')
  }
}

/**
 * Get OAuth token URL
 * @returns {string} OAuth token endpoint
 */
export function getOAuthUrl() {
  return `${darajaConfig.baseUrl}/oauth/v1/generate?grant_type=client_credentials`
}

/**
 * Get STK Push URL
 * @returns {string} STK Push endpoint
 */
export function getSTKPushUrl() {
  return `${darajaConfig.baseUrl}/mpesa/stkpush/v1/processrequest`
}

/**
 * Get STK Push Query URL
 * @returns {string} STK Push query endpoint
 */
export function getSTKQueryUrl() {
  return `${darajaConfig.baseUrl}/mpesa/stkpushquery/v1/query`
}
