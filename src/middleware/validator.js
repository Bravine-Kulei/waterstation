/**
 * Input validation utilities
 * Provides common validation functions
 */

/**
 * Validate required fields in request body
 * @param {Object} req - Express request object
 * @param {Array<string>} fields - Array of required field names
 * @returns {Object|null} Error object or null if valid
 */
export function validateRequired(req, fields) {
  const missing = fields.filter((field) => !req.body[field]);
  if (missing.length > 0) {
    return {
      message: `Missing required fields: ${missing.join(', ')}`,
      fields: missing,
    };
  }
  return null;
}

/**
 * Validate field types
 * @param {Object} req - Express request object
 * @param {Object} schema - Schema object mapping field names to types
 * @returns {Object|null} Error object or null if valid
 */
export function validateTypes(req, schema) {
  const errors = [];
  for (const [field, type] of Object.entries(schema)) {
    if (req.body[field] !== undefined) {
      const value = req.body[field];
      const actualType = typeof value;
      if (actualType !== type) {
        errors.push({
          field,
          expected: type,
          actual: actualType,
        });
      }
    }
  }
  if (errors.length > 0) {
    return {
      message: 'Type validation failed',
      errors,
    };
  }
  return null;
}

/**
 * Validation middleware factory
 * @param {Function} validator - Validation function
 * @returns {Function} Express middleware
 */
export function validate(validator) {
  return (req, res, next) => {
    const error = validator(req);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          ...error,
        },
      });
    }
    next();
  };
}
