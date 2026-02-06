import axios from 'axios'
import { darajaConfig, getOAuthUrl, getSTKPushUrl, getSTKQueryUrl } from '../config/daraja.config.js'
import { AppError } from '../middleware/errorHandler.js'
import { logEvent } from '../middleware/logger.js'

/**
 * Daraja Service
 * Handles M-Pesa Daraja API integration including OAuth and STK Push
 * 
 * Documentation: https://developer.safaricom.co.ke/
 */
class DarajaService {
  constructor() {
    this.accessToken = null
    this.tokenExpiry = null
  }

  /**
   * Get OAuth access token from Daraja API
   * Caches token for configured duration (default 55 minutes)
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken
      }

      // Create Basic Auth credentials
      const auth = Buffer.from(
        `${darajaConfig.consumerKey}:${darajaConfig.consumerSecret}`
      ).toString('base64')

      logEvent('daraja_oauth_request', {
        environment: darajaConfig.environment,
      })

      const response = await axios.get(getOAuthUrl(), {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: darajaConfig.requestTimeout,
      })

      if (!response.data || !response.data.access_token) {
        throw new AppError('Failed to get access token from Daraja API', 500)
      }

      this.accessToken = response.data.access_token
      
      // Set token expiry (subtract 5 minutes for safety)
      this.tokenExpiry = new Date(Date.now() + darajaConfig.tokenCacheDuration)

      logEvent('daraja_oauth_success', {
        expiresIn: response.data.expires_in,
      })

      return this.accessToken
    } catch (error) {
      logEvent('daraja_oauth_failed', {
        error: error.message,
        status: error.response?.status,
      })

      if (error.response) {
        throw new AppError(
          `Daraja OAuth failed: ${error.response.data?.error_description || error.message}`,
          error.response.status || 500
        )
      }

      throw new AppError(`Daraja OAuth failed: ${error.message}`, 500)
    }
  }

  /**
   * Initiate STK Push (M-Pesa prompt on customer's phone)
   * @param {Object} params - STK Push parameters
   * @param {string} params.phoneNumber - Customer phone number (254XXXXXXXXX)
   * @param {number} params.amount - Amount to charge
   * @param {string} params.accountReference - Transaction reference
   * @param {string} params.transactionDesc - Transaction description
   * @returns {Promise<Object>} STK Push response
   */
  async initiateSTKPush({ phoneNumber, amount, accountReference, transactionDesc }) {
    try {
      const accessToken = await this.getAccessToken()

      // Generate timestamp (YYYYMMDDHHmmss)
      const timestamp = this._generateTimestamp()

      // Generate password (Base64(Shortcode + Passkey + Timestamp))
      const password = Buffer.from(
        `${darajaConfig.shortcode}${darajaConfig.passkey}${timestamp}`
      ).toString('base64')

      const payload = {
        BusinessShortCode: darajaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline', // For Till Number
        Amount: Math.round(amount), // Must be integer
        PartyA: phoneNumber, // Customer phone number
        PartyB: darajaConfig.shortcode, // Till Number
        PhoneNumber: phoneNumber, // Phone to receive prompt
        CallBackURL: darajaConfig.callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc || 'Water Purchase',
      }

      logEvent('daraja_stkpush_request', {
        phoneNumber,
        amount,
        accountReference,
      })

      const response = await axios.post(getSTKPushUrl(), payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: darajaConfig.requestTimeout,
      })

      if (!response.data) {
        throw new AppError('Empty response from Daraja STK Push API', 500)
      }

      // Check for error response
      if (response.data.errorCode) {
        throw new AppError(
          `STK Push failed: ${response.data.errorMessage}`,
          400
        )
      }

      logEvent('daraja_stkpush_success', {
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        responseCode: response.data.ResponseCode,
      })

      return {
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      }
    } catch (error) {
      logEvent('daraja_stkpush_failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      })

      if (error instanceof AppError) {
        throw error
      }

      if (error.response) {
        const errorMessage = error.response.data?.errorMessage || 
                           error.response.data?.ResponseDescription ||
                           error.message
        throw new AppError(`STK Push failed: ${errorMessage}`, error.response.status || 500)
      }

      throw new AppError(`STK Push failed: ${error.message}`, 500)
    }
  }

  /**
   * Query STK Push transaction status
   * @param {string} checkoutRequestId - Checkout Request ID from STK Push
   * @returns {Promise<Object>} Transaction status
   */
  async querySTKPushStatus(checkoutRequestId) {
    try {
      const accessToken = await this.getAccessToken()

      const timestamp = this._generateTimestamp()
      const password = Buffer.from(
        `${darajaConfig.shortcode}${darajaConfig.passkey}${timestamp}`
      ).toString('base64')

      const payload = {
        BusinessShortCode: darajaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }

      logEvent('daraja_stkquery_request', {
        checkoutRequestId,
      })

      const response = await axios.post(getSTKQueryUrl(), payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: darajaConfig.requestTimeout,
      })

      if (!response.data) {
        throw new AppError('Empty response from Daraja STK Query API', 500)
      }

      logEvent('daraja_stkquery_success', {
        checkoutRequestId,
        resultCode: response.data.ResultCode,
      })

      return {
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
      }
    } catch (error) {
      logEvent('daraja_stkquery_failed', {
        error: error.message,
        checkoutRequestId,
      })

      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(`STK Query failed: ${error.message}`, 500)
    }
  }

  /**
   * Validate M-Pesa callback data
   * @param {Object} callbackData - Callback data from Daraja
   * @returns {Object} Validated and parsed callback data
   */
  validateCallback(callbackData) {
    try {
      if (!callbackData || !callbackData.Body) {
        throw new AppError('Invalid callback data structure', 400)
      }

      const body = callbackData.Body.stkCallback

      if (!body) {
        throw new AppError('Missing stkCallback in callback data', 400)
      }

      const result = {
        merchantRequestId: body.MerchantRequestID,
        checkoutRequestId: body.CheckoutRequestID,
        resultCode: body.ResultCode,
        resultDesc: body.ResultDesc,
        callbackMetadata: {},
      }

      // Extract metadata if payment was successful
      if (body.ResultCode === 0 && body.CallbackMetadata) {
        const items = body.CallbackMetadata.Item || []
        
        items.forEach((item) => {
          const key = item.Name
          const value = item.Value

          switch (key) {
            case 'Amount':
              result.callbackMetadata.amount = value
              break
            case 'MpesaReceiptNumber':
              result.callbackMetadata.mpesaReceiptNumber = value
              break
            case 'TransactionDate':
              result.callbackMetadata.transactionDate = value
              break
            case 'PhoneNumber':
              result.callbackMetadata.phoneNumber = value
              break
          }
        })
      }

      return result
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(`Callback validation failed: ${error.message}`, 400)
    }
  }

  /**
   * Generate timestamp in format YYYYMMDDHHmmss
   * @private
   * @returns {string} Formatted timestamp
   */
  _generateTimestamp() {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}${hours}${minutes}${seconds}`
  }

  /**
   * Clear cached access token (useful for testing or forcing refresh)
   */
  clearTokenCache() {
    this.accessToken = null
    this.tokenExpiry = null
  }
}

export default new DarajaService()
