import { validateAmount } from '../utils/amountValidator.js';
import { AppError } from './errorHandler.js';

/**
 * Validate payment initialization request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function validatePaymentRequest(req, res, next) {
  const { email, amount } = req.body;

  // Validate email
  if (!email || typeof email !== 'string') {
    return next(new AppError('Valid email address is required', 400));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError('Invalid email address format', 400));
  }

  // Validate amount
  const amountValidation = validateAmount(amount);
  if (!amountValidation.valid) {
    return next(new AppError(amountValidation.error, 400));
  }

  // Attach normalized values to request for use in controller/service
  req.validatedData = {
    email: email.toLowerCase().trim(),
    amount: amountValidation.normalized,
  };

  next();
}
