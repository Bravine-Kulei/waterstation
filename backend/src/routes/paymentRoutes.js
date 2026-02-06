import express from 'express'
import paymentController from '../controllers/paymentController.js'
import mpesaPaymentController from '../controllers/mpesaPaymentController.js'
import mpesaTransactionRepository from '../repositories/mpesaTransactionRepository.js'
import transactionRepository from '../repositories/transactionRepository.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { validatePaymentRequest } from '../middleware/paymentValidator.js'
import { AppError } from '../middleware/errorHandler.js'

const router = express.Router()

// ============= PAYMENT PREVIEW =============

/**
 * @route   POST /api/payments/preview
 * @desc    Get payment preview (amount → liters conversion)
 * @access  Public
 */
router.post(
  '/preview',
  asyncHandler(mpesaPaymentController.getPaymentPreview.bind(mpesaPaymentController))
)

// ============= PAYSTACK ROUTES =============

/**
 * @route   POST /api/payments/paystack/initialize
 * @desc    Initialize a Paystack payment
 * @access  Public (should be protected in production)
 */
router.post(
  '/paystack/initialize',
  validatePaymentRequest,
  asyncHandler(paymentController.initializePayment.bind(paymentController))
)

/**
 * @route   GET /api/payments/paystack/verify/:transactionReference
 * @desc    Verify payment status from Paystack
 * @access  Public (should be protected in production)
 */
router.get(
  '/paystack/verify/:transactionReference',
  asyncHandler(paymentController.verifyPayment.bind(paymentController))
)

/**
 * @route   GET /api/payments/paystack/callback
 * @desc    Paystack redirect URL after checkout (browser redirect, not webhook)
 * @access  Public
 * @note    This endpoint is typically hit by the customer's browser after payment.
 */
router.get(
  '/paystack/callback',
  asyncHandler(paymentController.handleCallback.bind(paymentController))
)

/**
 * @route   POST /api/payments/paystack/webhook
 * @desc    Handle Paystack webhook events
 * @access  Public (called by Paystack)
 * @note    Webhook signature verification is handled in the controller
 * @note    For proper signature verification, raw body is needed
 */
router.post(
  '/paystack/webhook',
  express.raw({ type: 'application/json' }), // Get raw body for signature verification
  asyncHandler(paymentController.handleWebhook.bind(paymentController))
)

// ============= M-PESA ROUTES =============

/**
 * @route   POST /api/payments/mpesa/initiate
 * @desc    Initiate M-Pesa payment (STK Push)
 * @access  Public (should be protected in production)
 */
router.post(
  '/mpesa/initiate',
  asyncHandler(mpesaPaymentController.initiatePayment.bind(mpesaPaymentController))
)

/**
 * @route   POST /api/payments/mpesa/callback
 * @desc    Handle M-Pesa callback from Daraja API
 * @access  Public (called by Safaricom Daraja)
 * @note    This endpoint receives STK Push results
 */
router.post(
  '/mpesa/callback',
  asyncHandler(mpesaPaymentController.handleCallback.bind(mpesaPaymentController))
)

/**
 * @route   GET /api/payments/mpesa/query/:transactionReference
 * @desc    Query M-Pesa payment status directly from Daraja API
 * @access  Public (should be protected in production)
 */
router.get(
  '/mpesa/query/:transactionReference',
  asyncHandler(mpesaPaymentController.queryPayment.bind(mpesaPaymentController))
)

// ============= SHARED STATUS ENDPOINT =============

/**
 * @route   GET /api/payments/status/:transactionReference
 * @desc    Get transaction status (checks both M-Pesa and Paystack)
 * @access  Public (should be protected in production)
 */
router.get(
  '/status/:transactionReference',
  asyncHandler(async (req, res, next) => {
    try {
      const { transactionReference } = req.params

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400)
      }

      // Try M-Pesa first
      let transaction = await mpesaTransactionRepository.findByReference(transactionReference)
      
      // If not found, try Paystack
      if (!transaction) {
        transaction = await transactionRepository.findByReference(transactionReference)
      }

      if (!transaction) {
        throw new AppError('Transaction not found', 404)
      }

      res.status(200).json({
        success: true,
        data: transaction,
      })
    } catch (error) {
      next(error)
    }
  })
)

export default router
