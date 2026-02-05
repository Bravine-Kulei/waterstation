import crypto from 'crypto';
import { otpConfig } from '../config/otp.config.js';

/**
 * Generate a secure random OTP
 * @returns {string} 6-digit OTP
 */
export function generateOTP() {
  // Generate cryptographically secure random number
  const min = Math.pow(10, otpConfig.length - 1);
  const max = Math.pow(10, otpConfig.length) - 1;
  
  // Use crypto.randomInt for secure random generation
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  
  // Map to OTP range
  const otp = (randomNumber % (max - min + 1)) + min;
  
  return otp.toString().padStart(otpConfig.length, '0');
}

/**
 * Hash OTP for secure storage
 * @param {string} otp - Plain OTP
 * @returns {string} Hashed OTP
 */
export function hashOTP(otp) {
  const hash = crypto.createHash(otpConfig.hashAlgorithm);
  hash.update(otp);
  return hash.digest('hex');
}

/**
 * Verify OTP against hash
 * @param {string} otp - Plain OTP to verify
 * @param {string} hash - Stored hash
 * @returns {boolean} True if OTP matches hash
 */
export function verifyOTP(otp, hash) {
  const computedHash = hashOTP(otp);
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(hash)
  );
}
