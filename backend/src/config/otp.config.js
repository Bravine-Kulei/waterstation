import dotenv from 'dotenv';

dotenv.config();

/**
 * OTP Configuration
 * All OTP-related settings loaded from environment variables
 */
export const otpConfig = {
  // OTP generation
  length: parseInt(process.env.OTP_LENGTH || '6', 10),
  
  // Expiration (in minutes)
  expirationMinutes: parseInt(process.env.OTP_EXPIRATION_MINUTES || '10', 10),
  
  // Security
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
  
  // Hash algorithm for OTP storage
  hashAlgorithm: process.env.OTP_HASH_ALGORITHM || 'sha256',
  
  // Redis cache settings
  cacheEnabled: process.env.OTP_CACHE_ENABLED !== 'false', // Default: true
  cacheTtlSeconds: parseInt(process.env.OTP_CACHE_TTL_SECONDS || '600', 10), // 10 minutes default
};

/**
 * Validate OTP configuration
 * @throws {Error} If configuration is invalid
 */
export function validateOtpConfig() {
  if (otpConfig.length < 4 || otpConfig.length > 10) {
    throw new Error('OTP_LENGTH must be between 4 and 10');
  }

  if (otpConfig.expirationMinutes < 1 || otpConfig.expirationMinutes > 1440) {
    throw new Error('OTP_EXPIRATION_MINUTES must be between 1 and 1440 (24 hours)');
  }

  if (otpConfig.maxAttempts < 1 || otpConfig.maxAttempts > 10) {
    throw new Error('OTP_MAX_ATTEMPTS must be between 1 and 10');
  }
}
