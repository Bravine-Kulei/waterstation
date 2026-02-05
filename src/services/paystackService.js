import crypto from 'crypto';
import { paystackConfig, getPaystackAuthHeader } from '../config/paystack.config.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Paystack Service
 * Handles Paystack API integration including checkout
 * Documentation: https://paystack.com/docs/payments/accept-payments/
 */
class PaystackService {
  /**
   * Initialize a transaction (creates payment page)
   * This is the standard Paystack checkout flow
   * @param {Object} params - Transaction parameters
   * @param {number} params.amount - Amount in kobo (smallest currency unit)
   * @param {string} params.email - Customer email
   * @param {string} params.reference - Transaction reference
   * @param {string} params.callbackUrl - Callback URL
   * @param {Object} params.metadata - Additional metadata
   * @param {string} params.currency - Currency code (default: NGN)
   * @returns {Promise<Object>} Transaction initialization response with checkout URL
   */
  async initializeTransaction(params) {
    const {
      amount,
      email,
      reference,
      callbackUrl,
      metadata = {},
      currency = 'NGN',
    } = params;

    try {
      const payload = {
        amount: Math.round(amount * 100), // Convert to kobo (smallest currency unit)
        email,
        reference,
        currency,
        callback_url: callbackUrl || paystackConfig.callbackUrl,
        metadata,
      };

      const url = `${paystackConfig.baseUrl}/transaction/initialize`;

      logEvent('paystack_transaction_initiated', {
        reference,
        amount,
        email,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: getPaystackAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        logEvent('paystack_transaction_init_failed', {
          status: response.status,
          error: responseData.message || responseData,
        });
        throw new AppError(
          responseData.message || `Transaction initialization failed: ${response.statusText}`,
          response.status
        );
      }

      if (!responseData.status) {
        logEvent('paystack_transaction_init_error', {
          message: responseData.message,
        });
        throw new AppError(
          responseData.message || 'Transaction initialization failed',
          400
        );
      }

      logEvent('paystack_transaction_init_success', {
        reference: responseData.data.reference,
        authorizationUrl: responseData.data.authorization_url,
      });

      return {
        authorizationUrl: responseData.data.authorization_url,
        accessCode: responseData.data.access_code,
        reference: responseData.data.reference,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logEvent('paystack_transaction_init_exception', {
        error: error.message,
      });
      throw new AppError(`Failed to initialize transaction: ${error.message}`, 500);
    }
  }

  /**
   * Verify a transaction
   * Checks the status of a transaction
   * @param {string} reference - Transaction reference
   * @returns {Promise<Object>} Transaction verification response
   */
  async verifyTransaction(reference) {
    try {
      const url = `${paystackConfig.baseUrl}/transaction/verify/${reference}`;

      logEvent('paystack_transaction_verification', {
        reference,
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: getPaystackAuthHeader(),
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        logEvent('paystack_verification_failed', {
          status: response.status,
          error: responseData.message || responseData,
        });
        throw new AppError(
          responseData.message || `Transaction verification failed: ${response.statusText}`,
          response.status
        );
      }

      if (!responseData.status) {
        logEvent('paystack_verification_error', {
          message: responseData.message,
        });
        throw new AppError(
          responseData.message || 'Transaction verification failed',
          400
        );
      }

      const transaction = responseData.data;

      logEvent('paystack_verification_success', {
        reference: transaction.reference,
        status: transaction.status,
      });

      return {
        reference: transaction.reference,
        status: transaction.status, // 'success', 'failed', 'abandoned', 'reversed'
        amount: transaction.amount / 100, // Convert from kobo
        currency: transaction.currency,
        customer: transaction.customer,
        authorization: transaction.authorization,
        paidAt: transaction.paid_at,
        createdAt: transaction.created_at,
        gatewayResponse: transaction.gateway_response,
        message: transaction.message,
        channel: transaction.channel,
        ipAddress: transaction.ip_address,
        metadata: transaction.metadata,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to verify transaction: ${error.message}`, 500);
    }
  }

  /**
   * Verify webhook signature
   * Validates that the webhook request is from Paystack
   * @param {string} signature - X-Paystack-Signature header value
   * @param {string|Buffer} body - Raw request body
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(signature, body) {
    if (!paystackConfig.webhookSecret) {
      logEvent('paystack_webhook_secret_missing');
      return false;
    }

    if (!signature) {
      return false;
    }

    // Convert body to string if it's a Buffer
    const bodyString = typeof body === 'string' ? body : body.toString('utf8');

    const hash = crypto
      .createHmac('sha512', paystackConfig.webhookSecret)
      .update(bodyString)
      .digest('hex');

    return hash === signature;
  }
}

export default new PaystackService();
