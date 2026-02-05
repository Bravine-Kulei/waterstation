import mpesaTransactionRepository from '../repositories/mpesaTransactionRepository.js'
import darajaService from './darajaService.js'
import smsService from './smsService.js'
import otpService from './otpService.js'
import { generateTransactionReference } from '../utils/transactionReference.js'
import { getPaymentPreview, validatePaymentAmount } from '../utils/pricingCalculator.js'
import { validatePhoneNumber } from '../utils/phoneValidator.js'
import { AppError } from '../middleware/errorHandler.js'
import { logEvent } from '../middleware/logger.js'

/**
 * M-Pesa Payment Service
 * Handles M-Pesa payment business logic using Daraja API
 */
class MpesaPaymentService {
  /**
   * Get payment preview (amount → liters conversion)
   * @param {number} amount - Payment amount
   * @returns {Object} Payment preview with liters calculation
   */
  getPaymentPreview(amount) {
    try {
      // Validate amount
      const validation = validatePaymentAmount(amount)
      if (!validation.valid) {
        throw new AppError(validation.errors.join(', '), 400)
      }

      // Get preview with rounding
      const preview = getPaymentPreview(amount)

      return {
        success: true,
        preview,
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(`Failed to generate payment preview: ${error.message}`, 500)
    }
  }

  /**
   * Initiate M-Pesa payment via STK Push
   * @param {Object} paymentData - Payment data
   * @param {string} paymentData.phoneNumber - Customer phone number
   * @param {number} paymentData.amount - Payment amount
   * @param {Object} paymentData.metadata - Additional metadata (optional)
   * @returns {Promise<Object>} Payment initiation result
   */
  async initiatePayment(paymentData) {
    const { phoneNumber, amount, metadata } = paymentData

    try {
      // Validate phone number
      const phoneValidation = validatePhoneNumber(phoneNumber)
      if (!phoneValidation.valid) {
        throw new AppError(phoneValidation.error, 400)
      }
      const normalizedPhone = phoneValidation.normalized

      // Validate amount
      const amountValidation = validatePaymentAmount(amount)
      if (!amountValidation.valid) {
        throw new AppError(amountValidation.errors.join(', '), 400)
      }

      // Get payment preview (adjusted amount and liters)
      const preview = getPaymentPreview(amount)

      // Generate unique transaction reference
      const transactionReference = generateTransactionReference()

      logEvent('mpesa_payment_initiated', {
        transactionReference,
        phoneNumber: normalizedPhone,
        requestedAmount: amount,
        adjustedAmount: preview.amount,
        liters: preview.liters,
      })

      // Create transaction record
      const transaction = await mpesaTransactionRepository.create({
        transactionReference,
        phoneNumber: normalizedPhone,
        amount: preview.amount,
        liters: preview.liters,
        status: 'pending',
        metadata: {
          ...metadata,
          requestedAmount: amount,
          pricePerLiter: preview.pricePerLiter,
        },
      })

      // Initiate STK Push
      let stkPushResult
      try {
        stkPushResult = await darajaService.initiateSTKPush({
          phoneNumber: normalizedPhone,
          amount: preview.amount,
          accountReference: transactionReference,
          transactionDesc: `Water Purchase ${preview.liters}L`,
        })

        // Update transaction with STK Push details
        await mpesaTransactionRepository.update(transactionReference, {
          status: 'processing',
          checkoutRequestId: stkPushResult.checkoutRequestId,
          merchantRequestId: stkPushResult.merchantRequestId,
        })

        logEvent('mpesa_stkpush_sent', {
          transactionReference,
          checkoutRequestId: stkPushResult.checkoutRequestId,
        })

        return {
          success: true,
          transactionReference,
          checkoutRequestId: stkPushResult.checkoutRequestId,
          amount: preview.amount,
          liters: preview.liters,
          phoneNumber: normalizedPhone,
          status: 'processing',
          message: stkPushResult.customerMessage || 'Please enter your M-Pesa PIN',
        }
      } catch (stkError) {
        // Update transaction status to failed
        await mpesaTransactionRepository.updateStatus(transactionReference, 'failed')

        logEvent('mpesa_stkpush_failed', {
          transactionReference,
          error: stkError.message,
        })

        throw new AppError(
          `Failed to initiate M-Pesa payment: ${stkError.message}`,
          stkError.statusCode || 500
        )
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }

      logEvent('mpesa_payment_initiation_error', {
        error: error.message,
      })

      throw new AppError(`Payment initiation failed: ${error.message}`, 500)
    }
  }

  /**
   * Handle M-Pesa callback from Daraja API
   * @param {Object} callbackData - Callback data from Daraja
   * @returns {Promise<Object>} Updated transaction
   */
  async handleCallback(callbackData) {
    try {
      // Validate and parse callback
      const parsed = darajaService.validateCallback(callbackData)

      // Find transaction by checkout request ID
      const transaction = await mpesaTransactionRepository.findByCheckoutRequestId(
        parsed.checkoutRequestId
      )

      if (!transaction) {
        logEvent('mpesa_callback_transaction_not_found', {
          checkoutRequestId: parsed.checkoutRequestId,
        })
        throw new AppError('Transaction not found', 404)
      }

      // Determine status from result code
      let status = 'failed'
      if (parsed.resultCode === 0) {
        status = 'completed'
      } else if (parsed.resultCode === 1032) {
        status = 'cancelled' // User cancelled
      } else if (parsed.resultCode === 1037) {
        status = 'timeout' // Timeout
      }

      // Update transaction
      const updates = {
        status,
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
      }

      // Add M-Pesa receipt and transaction date if payment succeeded
      if (status === 'completed' && parsed.callbackMetadata) {
        updates.mpesaReceiptNumber = parsed.callbackMetadata.mpesaReceiptNumber
        updates.transactionDate = this._parseTransactionDate(
          parsed.callbackMetadata.transactionDate
        )
      }

      const updatedTransaction = await mpesaTransactionRepository.update(
        transaction.transactionReference,
        updates
      )

      logEvent('mpesa_callback_processed', {
        transactionReference: transaction.transactionReference,
        status,
        resultCode: parsed.resultCode,
      })

      // If payment successful, generate OTP and send SMS
      if (status === 'completed') {
        try {
          // Generate OTP
          const otpData = await otpService.generateOTP({
            transactionReference: transaction.transactionReference,
            liters: transaction.liters,
          })

          // Send OTP via SMS
          await smsService.sendOTP({
            phoneNumber: `+${transaction.phoneNumber}`, // Add + for Africa's Talking
            otp: otpData.otp,
            liters: transaction.liters,
            expiresInMinutes: otpData.expiresInMinutes,
          })

          logEvent('mpesa_otp_sent', {
            transactionReference: transaction.transactionReference,
          })
        } catch (otpError) {
          // Log error but don't fail the callback
          logEvent('mpesa_otp_generation_failed', {
            transactionReference: transaction.transactionReference,
            error: otpError.message,
          })
        }
      }

      return updatedTransaction
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(`Callback processing failed: ${error.message}`, 500)
    }
  }

  /**
   * Get transaction status
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionStatus(transactionReference) {
    const transaction = await mpesaTransactionRepository.findByReference(transactionReference)

    if (!transaction) {
      throw new AppError('Transaction not found', 404)
    }

    // Check for timeout (30 minutes)
    if (transaction.status === 'pending' || transaction.status === 'processing') {
      const now = new Date()
      const createdAt = new Date(transaction.createdAt)
      const diffMinutes = (now - createdAt) / (1000 * 60)

      if (diffMinutes > 30) {
        await mpesaTransactionRepository.updateStatus(transactionReference, 'timeout')
        transaction.status = 'timeout'
      }
    }

    return transaction
  }

  /**
   * Verify payment status from Daraja API
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object>} Updated transaction status
   */
  async verifyPayment(transactionReference) {
    const transaction = await mpesaTransactionRepository.findByReference(transactionReference)

    if (!transaction) {
      throw new AppError('Transaction not found', 404)
    }

    if (!transaction.checkoutRequestId) {
      throw new AppError('Transaction does not have a checkout request ID', 400)
    }

    try {
      const queryResult = await darajaService.querySTKPushStatus(transaction.checkoutRequestId)

      // Determine status from result code
      let status = 'failed'
      if (queryResult.resultCode === 0) {
        status = 'completed'
      } else if (queryResult.resultCode === 1032) {
        status = 'cancelled'
      } else if (queryResult.resultCode === 1037) {
        status = 'timeout'
      }

      // Update transaction
      const updatedTransaction = await mpesaTransactionRepository.update(transactionReference, {
        status,
        resultCode: queryResult.resultCode,
        resultDesc: queryResult.resultDesc,
      })

      logEvent('mpesa_payment_verified', {
        transactionReference,
        status,
        resultCode: queryResult.resultCode,
      })

      return updatedTransaction
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(`Failed to verify payment: ${error.message}`, 500)
    }
  }

  /**
   * Parse M-Pesa transaction date
   * Format: YYYYMMDDHHmmss
   * @private
   * @param {number|string} transactionDate - Transaction date from M-Pesa
   * @returns {Date} Parsed date
   */
  _parseTransactionDate(transactionDate) {
    const dateStr = transactionDate.toString()
    
    if (dateStr.length !== 14) {
      return new Date()
    }

    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    const hours = dateStr.substring(8, 10)
    const minutes = dateStr.substring(10, 12)
    const seconds = dateStr.substring(12, 14)

    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`)
  }
}

export default new MpesaPaymentService()
