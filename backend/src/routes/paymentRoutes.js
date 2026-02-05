import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validatePaymentRequest } from '../middleware/paymentValidator.js';

const router = express.Router();

/**
 * @route   POST /api/payments/initialize
 * @desc    Initialize a Paystack payment
 * @access  Public (should be protected in production)
 */
router.post(
  '/initialize',
  validatePaymentRequest,
  asyncHandler(paymentController.initializePayment.bind(paymentController))
);

/**
 * @route   GET /api/payments/status/:transactionReference
 * @desc    Get transaction status
 * @access  Public (should be protected in production)
 */
router.get(
  '/status/:transactionReference',
  asyncHandler(paymentController.getTransactionStatus.bind(paymentController))
);

/**
 * @route   GET /api/payments/verify/:transactionReference
 * @desc    Verify payment status from Paystack
 * @access  Public (should be protected in production)
 */
router.get(
  '/verify/:transactionReference',
  asyncHandler(paymentController.verifyPayment.bind(paymentController))
);

/**
 * @route   GET /api/payments/callback
 * @desc    Paystack redirect URL after checkout (browser redirect, not webhook)
 * @access  Public
 * @note    This endpoint is typically hit by the customer's browser after payment.
 */
router.get(
  '/callback',
  asyncHandler(paymentController.handleCallback.bind(paymentController))
);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Paystack webhook events
 * @access  Public (called by Paystack)
 * @note    Webhook signature verification is handled in the controller
 * @note    For proper signature verification, raw body is needed
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Get raw body for signature verification
  asyncHandler(paymentController.handleWebhook.bind(paymentController))
);

export default router;
