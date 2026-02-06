import dotenv from 'dotenv'

dotenv.config()

/**
 * Africa's Talking SMS Configuration
 * All SMS-related settings loaded from environment variables
 * 
 * Documentation: https://developers.africastalking.com/docs/sms/overview
 */
export const smsConfig = {
  // API Credentials
  apiKey: process.env.AT_API_KEY || '',
  username: process.env.AT_USERNAME || 'sandbox',
  
  // Sender ID
  senderId: process.env.AT_SENDER_ID || 'WATERKIOSK',
  
  // Environment
  environment: process.env.AT_ENVIRONMENT || 'sandbox',
  
  // SMS Settings
  enqueue: process.env.AT_ENQUEUE === 'true', // Whether to enqueue messages
  
  // Retry settings
  maxRetries: parseInt(process.env.AT_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.AT_RETRY_DELAY || '2000', 10), // 2 seconds
}

/**
 * Validate required SMS configuration
 * @throws {Error} If required configuration is missing
 */
export function validateSmsConfig() {
  const required = ['apiKey', 'username']
  const missing = required.filter((key) => !smsConfig[key])

  if (missing.length > 0) {
    throw new Error(`Missing required SMS configuration: ${missing.join(', ')}`)
  }

  // Validate username format
  if (smsConfig.username && smsConfig.username.trim() === '') {
    throw new Error('AT_USERNAME cannot be empty')
  }

  // Warn if using sandbox
  if (smsConfig.username === 'sandbox' && smsConfig.environment !== 'production') {
    console.warn('Warning: Using Africa\'s Talking sandbox mode. SMS will not be delivered to real phones.')
  }
}

/**
 * Check if in sandbox mode
 * @returns {boolean} True if in sandbox mode
 */
export function isSandboxMode() {
  return smsConfig.username === 'sandbox' || smsConfig.environment === 'sandbox'
}
