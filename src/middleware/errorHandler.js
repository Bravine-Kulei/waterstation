import { isDevelopment } from '../config/app.config.js';

/**
 * Centralized error handler middleware
 * Handles all errors in a consistent manner
 */

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  // Log error for monitoring and debugging
  console.error('Error:', {
    message: err.message,
    stack: isDevelopment() ? err.stack : undefined,
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Determine error message
  let message = err.message || 'Internal Server Error';

  // Don't leak error details in production for non-operational errors
  if (!err.isOperational && !isDevelopment()) {
    message = 'An unexpected error occurred';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(isDevelopment() && { stack: err.stack }),
    },
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function notFoundHandler(req, res, next) {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
}
