import AfricasTalking from 'africastalking'
import { smsConfig, isSandboxMode } from '../config/sms.config.js'
import { AppError } from '../middleware/errorHandler.js'
import { logEvent } from '../middleware/logger.js'

/**
 * SMS Service
 * Handles SMS sending via Africa's Talking API
 * 
 * Documentation: https://developers.africastalking.com/docs/sms/overview
 */
class SmsService {
  constructor() {
    // Initialize Africa's Talking SDK
    this.client = AfricasTalking({
      apiKey: smsConfig.apiKey,
      username: smsConfig.username,
    })
    
    this.sms = this.client.SMS
  }

  /**
   * Send SMS message
   * @param {Object} params - SMS parameters
   * @param {string|string[]} params.to - Recipient phone number(s)
   * @param {string} params.message - Message content
   * @param {string} params.from - Sender ID (optional)
   * @returns {Promise<Object>} SMS sending result
   */
  async send({ to, message, from = null }) {
    try {
      // Ensure 'to' is an array
      const recipients = Array.isArray(to) ? to : [to]

      // Validate phone numbers
      for (const phone of recipients) {
        if (!this._isValidPhoneNumber(phone)) {
          throw new AppError(`Invalid phone number format: ${phone}`, 400)
        }
      }

      // Validate message
      if (!message || message.trim().length === 0) {
        throw new AppError('SMS message cannot be empty', 400)
      }

      const options = {
        to: recipients,
        message: message.trim(),
        enqueue: smsConfig.enqueue,
      }

      // Add sender ID if provided
      if (from || smsConfig.senderId) {
        options.from = from || smsConfig.senderId
      }

      logEvent('sms_send_request', {
        recipients: recipients.length,
        messageLength: message.length,
        sandbox: isSandboxMode(),
      })

      const response = await this.sms.send(options)

      // Parse response
      const result = this._parseResponse(response)

      logEvent('sms_send_success', {
        recipients: result.totalRecipients,
        successful: result.successful,
        failed: result.failed,
      })

      return result
    } catch (error) {
      logEvent('sms_send_failed', {
        error: error.message,
        to,
      })

      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(`Failed to send SMS: ${error.message}`, 500)
    }
  }

  /**
   * Send OTP via SMS
   * @param {Object} params - OTP SMS parameters
   * @param {string} params.phoneNumber - Recipient phone number
   * @param {string} params.otp - OTP code
   * @param {number} params.liters - Water amount in liters
   * @param {number} params.expiresInMinutes - OTP expiration time
   * @returns {Promise<Object>} SMS sending result
   */
  async sendOTP({ phoneNumber, otp, liters, expiresInMinutes }) {
    try {
      // Format OTP message
      const message = this._formatOTPMessage({ otp, liters, expiresInMinutes })

      // Send SMS with retry logic
      return await this._sendWithRetry({
        to: phoneNumber,
        message,
      })
    } catch (error) {
      logEvent('sms_otp_send_failed', {
        phoneNumber,
        error: error.message,
      })

      // Don't throw error - log it but allow OTP generation to succeed
      // User can still use OTP even if SMS fails
      console.error('Failed to send OTP SMS:', error.message)
      
      return {
        success: false,
        error: error.message,
        message: 'OTP generated but SMS delivery failed',
      }
    }
  }

  /**
   * Send payment confirmation SMS
   * @param {Object} params - Payment confirmation parameters
   * @param {string} params.phoneNumber - Recipient phone number
   * @param {number} params.amount - Payment amount
   * @param {string} params.mpesaReceipt - M-Pesa receipt number
   * @param {number} params.liters - Water amount
   * @returns {Promise<Object>} SMS sending result
   */
  async sendPaymentConfirmation({ phoneNumber, amount, mpesaReceipt, liters }) {
    try {
      const message = 
        `Payment confirmed!\n` +
        `Amount: KES ${amount}\n` +
        `Water: ${liters}L\n` +
        `Receipt: ${mpesaReceipt}\n` +
        `Your OTP will be sent shortly.`

      return await this.send({
        to: phoneNumber,
        message,
      })
    } catch (error) {
      console.error('Failed to send payment confirmation SMS:', error.message)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Send SMS with retry logic
   * @private
   * @param {Object} params - SMS parameters
   * @returns {Promise<Object>} SMS sending result
   */
  async _sendWithRetry(params) {
    let lastError
    
    for (let attempt = 1; attempt <= smsConfig.maxRetries; attempt++) {
      try {
        return await this.send(params)
      } catch (error) {
        lastError = error
        
        if (attempt < smsConfig.maxRetries) {
          logEvent('sms_retry', {
            attempt,
            maxRetries: smsConfig.maxRetries,
            error: error.message,
          })
          
          // Wait before retrying
          await this._sleep(smsConfig.retryDelay * attempt)
        }
      }
    }

    throw lastError
  }

  /**
   * Format OTP message
   * @private
   * @param {Object} params - Message parameters
   * @returns {string} Formatted message
   */
  _formatOTPMessage({ otp, liters, expiresInMinutes }) {
    return (
      `Your Water Kiosk OTP is: ${otp}\n` +
      `Water: ${liters}L\n` +
      `Valid for ${expiresInMinutes} minutes.\n` +
      `Do not share this code.`
    )
  }

  /**
   * Parse Africa's Talking SMS response
   * @private
   * @param {Object} response - API response
   * @returns {Object} Parsed response
   */
  _parseResponse(response) {
    const recipients = response.SMSMessageData?.Recipients || []
    
    const successful = recipients.filter(r => 
      r.statusCode === 101 || r.status === 'Success'
    ).length
    
    const failed = recipients.filter(r => 
      r.statusCode !== 101 && r.status !== 'Success'
    ).length

    return {
      message: response.SMSMessageData?.Message || 'SMS sent',
      totalRecipients: recipients.length,
      successful,
      failed,
      recipients: recipients.map(r => ({
        phoneNumber: r.number,
        status: r.status,
        statusCode: r.statusCode,
        messageId: r.messageId,
        cost: r.cost,
      })),
    }
  }

  /**
   * Validate phone number format
   * @private
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} True if valid
   */
  _isValidPhoneNumber(phoneNumber) {
    // Africa's Talking requires international format starting with +
    // Example: +254712345678
    const phoneRegex = /^\+\d{10,15}$/
    return phoneRegex.test(phoneNumber)
  }

  /**
   * Sleep helper for retry delays
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get SMS balance (for monitoring)
   * @returns {Promise<Object>} Account balance
   */
  async getBalance() {
    try {
      const response = await this.client.APPLICATION.fetchApplicationData()
      return {
        balance: response.UserData?.balance || 'Unknown',
      }
    } catch (error) {
      console.error('Failed to fetch SMS balance:', error.message)
      return {
        balance: 'Unknown',
        error: error.message,
      }
    }
  }
}

export default new SmsService()
