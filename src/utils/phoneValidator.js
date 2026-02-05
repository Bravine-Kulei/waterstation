/**
 * Validate Kenyan phone number format
 * Supports formats: 254712345678, 0712345678, +254712345678
 * @param {string} phoneNumber - Phone number to validate
 * @returns {Object} { valid: boolean, normalized: string, error: string }
 */
export function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      valid: false,
      normalized: null,
      error: 'Phone number is required',
    };
  }

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Handle different formats
  let normalized;

  // Format: +254712345678
  if (cleaned.startsWith('+254')) {
    normalized = cleaned.substring(1); // Remove +
  }
  // Format: 254712345678
  else if (cleaned.startsWith('254')) {
    normalized = cleaned;
  }
  // Format: 0712345678 or 712345678
  else if (cleaned.startsWith('0')) {
    normalized = '254' + cleaned.substring(1);
  }
  // Format: 712345678 (without leading 0)
  else if (cleaned.length === 9) {
    normalized = '254' + cleaned;
  }
  else {
    return {
      valid: false,
      normalized: null,
      error: 'Invalid phone number format',
    };
  }

  // Validate length (should be 12 digits: 254 + 9 digits)
  if (normalized.length !== 12) {
    return {
      valid: false,
      normalized: null,
      error: 'Phone number must be 12 digits (254XXXXXXXXX)',
    };
  }

  // Validate it starts with 254
  if (!normalized.startsWith('254')) {
    return {
      valid: false,
      normalized: null,
      error: 'Phone number must start with 254',
    };
  }

  // Validate the remaining digits (should be 9 digits starting with 7)
  const subscriberNumber = normalized.substring(3);
  if (!/^7\d{8}$/.test(subscriberNumber)) {
    return {
      valid: false,
      normalized: null,
      error: 'Invalid Kenyan phone number format',
    };
  }

  return {
    valid: true,
    normalized,
    error: null,
  };
}
