import crypto from 'crypto';

/**
 * Generate a unique transaction reference
 * Format: WS-{timestamp}-{random}
 * @param {string} prefix - Optional prefix (default: 'WS')
 * @returns {string} Unique transaction reference
 */
export function generateTransactionReference(prefix = 'WS') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate transaction reference format
 * @param {string} reference - Transaction reference to validate
 * @returns {boolean} True if valid format
 */
export function isValidTransactionReference(reference) {
  if (!reference || typeof reference !== 'string') {
    return false;
  }
  // Format: PREFIX-TIMESTAMP-RANDOM (e.g., WS-1234567890-ABCD1234)
  const pattern = /^[A-Z0-9]+-\d+-[A-Z0-9]+$/;
  return pattern.test(reference);
}
