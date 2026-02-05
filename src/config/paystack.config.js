import dotenv from 'dotenv';

dotenv.config();

/**
 * Paystack API configuration
 * All Paystack-related settings loaded from environment variables
 * 
 * Documentation: https://paystack.com/docs/payments/accept-payments/
 */
export const paystackConfig = {
  // API endpoints
  baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  
  // Webhook
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  
  // Callback URLs
  callbackUrl: process.env.PAYSTACK_CALLBACK_URL || '',
  
  // Environment
  environment: process.env.PAYSTACK_ENVIRONMENT || 'test', // 'test' or 'live'
};

/**
 * Validate required Paystack configuration
 * @throws {Error} If required configuration is missing
 */
export function validatePaystackConfig() {
  const required = ['secretKey'];
  const missing = required.filter((key) => !paystackConfig[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required Paystack configuration: ${missing.join(', ')}`);
  }

  // Validate environment
  if (paystackConfig.environment && !['test', 'live'].includes(paystackConfig.environment)) {
    throw new Error('PAYSTACK_ENVIRONMENT must be either "test" or "live"');
  }
}

/**
 * Get Paystack authorization header
 * @returns {string} Authorization header value
 */
export function getPaystackAuthHeader() {
  return `Bearer ${paystackConfig.secretKey}`;
}
