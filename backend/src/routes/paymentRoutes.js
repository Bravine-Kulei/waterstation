import express from 'express'
import mpesaPaymentController from '../controllers/mpesaPaymentController.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

/**
 * @route   POST /api/payments/preview
 * @desc    Get payment preview (amount → liters conversion)
 * @access  Public
 */
router.post(
  '/preview',
  asyncHandler(mpesaPaymentController.getPaymentPreview.bind(mpesaPaymentController))
)

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
 * @route   GET /api/payments/status/:transactionReference
 * @desc    Get transaction status
 * @access  Public (should be protected in production)
 */
router.get(
  '/status/:transactionReference',
  asyncHandler(mpesaPaymentController.getTransactionStatus.bind(mpesaPaymentController))
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

export default router
