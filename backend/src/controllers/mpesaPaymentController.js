import mpesaPaymentService from '../services/mpesaPaymentService.js'
import { AppError } from '../middleware/errorHandler.js'
import { logEvent } from '../middleware/logger.js'

/**
 * M-Pesa Payment Controller
 * Handles HTTP requests for M-Pesa payment operations using Daraja API
 */
class MpesaPaymentController {
  /**
   * Get payment preview (amount → liters conversion)
   * POST /api/payments/preview
   */
  async getPaymentPreview(req, res, next) {
    try {
      const { amount } = req.body

      if (!amount || typeof amount !== 'number') {
        throw new AppError('Amount is required and must be a number', 400)
      }

      const preview = mpesaPaymentService.getPaymentPreview(amount)

      res.status(200).json({
        success: true,
        message: 'Payment preview generated',
        data: preview.preview,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Initiate M-Pesa payment (STK Push)
   * POST /api/payments/mpesa/initiate
   */
  async initiatePayment(req, res, next) {
    try {
      const { phoneNumber, amount, metadata } = req.body

      if (!phoneNumber || !amount) {
        throw new AppError('Phone number and amount are required', 400)
      }

      const result = await mpesaPaymentService.initiatePayment({
        phoneNumber,
        amount,
        metadata,
      })

      res.status(201).json({
        success: true,
        message: 'M-Pesa payment initiated. Please enter your PIN.',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Handle M-Pesa callback from Daraja
   * POST /api/payments/mpesa/callback
   */
  async handleCallback(req, res, next) {
    // Store raw body for logging
    const callbackData = req.body

    try {
      // Log raw callback payload for auditing
      logEvent('mpesa_callback_received', {
        checkoutRequestId: callbackData?.Body?.stkCallback?.CheckoutRequestID,
        timestamp: new Date().toISOString(),
      })

      // Process callback
      const result = await mpesaPaymentService.handleCallback(callbackData)

      // M-Pesa expects a 200 response
      res.status(200).json({
        success: true,
        message: 'Callback processed successfully',
      })

      logEvent('mpesa_callback_processed', {
        transactionReference: result.transactionReference,
        status: result.status,
      })
    } catch (error) {
      // Log error but still return 200 to M-Pesa
      // We don't want M-Pesa to keep retrying if it's our error
      logEvent('mpesa_callback_processing_error', {
        error: error.message,
      })

      console.error('M-Pesa callback processing error:', error)

      // Return 200 to M-Pesa to prevent retries
      res.status(200).json({
        success: false,
        message: error.message || 'Callback processing failed',
      })
    }
  }

  /**
   * Get transaction status
   * GET /api/payments/status/:transactionReference
   */
  async getTransactionStatus(req, res, next) {
    try {
      const { transactionReference } = req.params

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400)
      }

      const transaction = await mpesaPaymentService.getTransactionStatus(transactionReference)

      res.status(200).json({
        success: true,
        data: transaction,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Verify payment status from Daraja API
   * GET /api/payments/mpesa/query/:transactionReference
   */
  async queryPayment(req, res, next) {
    try {
      const { transactionReference } = req.params

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400)
      }

      const transaction = await mpesaPaymentService.verifyPayment(transactionReference)

      res.status(200).json({
        success: true,
        message: 'Payment status verified from M-Pesa',
        data: transaction,
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new MpesaPaymentController()
