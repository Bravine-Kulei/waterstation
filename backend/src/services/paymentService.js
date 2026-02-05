import transactionRepository from '../repositories/transactionRepository.js';
import paystackService from './paystackService.js';
import { generateTransactionReference } from '../utils/transactionReference.js';
import { validateAmount } from '../utils/amountValidator.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Payment Service
 * Handles payment business logic using Paystack
 */
class PaymentService {
  /**
   * Initiate payment
   * @param {Object} paymentData - Payment data
   * @param {string} paymentData.email - Customer email (required)
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.currency - Currency code (default: NGN)
   * @param {string} paymentData.description - Payment description
   * @param {string} paymentData.phoneNumber - Phone number (optional)
   * @param {Object} paymentData.metadata - Additional metadata
   * @returns {Promise<Object>} Payment initiation result
   */
  async initiatePayment(paymentData) {
    const { email, amount, currency = 'NGN', description, phoneNumber, metadata } = paymentData;

    // Validate email
    if (!email || typeof email !== 'string' || !this._isValidEmail(email)) {
      throw new AppError('Valid email address is required', 400);
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      throw new AppError(amountValidation.error, 400);
    }

    // Generate unique transaction reference
    const transactionReference = generateTransactionReference();

    // Calculate expiration time (24 hours from now for Paystack)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    try {
      // Create transaction record
      const transaction = await transactionRepository.create({
        transactionReference,
        email,
        phoneNumber: phoneNumber || null,
        amount: amountValidation.normalized,
        currency,
        status: 'pending',
        metadata: metadata || null,
        expiresAt,
      });

      logEvent('payment_initiated', {
        transactionReference,
        email,
        amount: amountValidation.normalized,
        currency,
      });

      // Initialize Paystack transaction
      let paystackResult;
      try {
        paystackResult = await paystackService.initializeTransaction({
          amount: amountValidation.normalized,
          email,
          reference: transactionReference,
          callbackUrl: undefined, // Will use default from config
          metadata: {
            ...metadata,
            transactionReference,
            description: description || 'Water Station Payment',
          },
          currency,
        });

        // Update transaction with Paystack data
        await transactionRepository.update(transactionReference, {
          paystackReference: paystackResult.reference,
          paystackAccessCode: paystackResult.accessCode,
          paystackAuthorizationUrl: paystackResult.authorizationUrl,
          status: 'processing',
        });

        logEvent('paystack_transaction_initialized', {
          transactionReference,
          paystackReference: paystackResult.reference,
        });

        return {
          transactionReference,
          authorizationUrl: paystackResult.authorizationUrl,
          accessCode: paystackResult.accessCode,
          status: 'processing',
          expiresAt,
        };
      } catch (paystackError) {
        // Update transaction status to failed
        await transactionRepository.updateStatus(transactionReference, 'failed');

        logEvent('paystack_init_failed', {
          transactionReference,
          error: paystackError.message,
        });

        // Re-throw with more context
        throw new AppError(
          `Failed to initiate payment: ${paystackError.message}`,
          paystackError.statusCode || 500
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logEvent('payment_initiation_error', {
        error: error.message,
      });

      throw new AppError(`Payment initiation failed: ${error.message}`, 500);
    }
  }

  /**
   * Get transaction status
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionStatus(transactionReference) {
    const transaction = await transactionRepository.findByReference(transactionReference);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    // Check if transaction has expired
    if (transaction.status === 'pending' && transaction.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(transaction.expiresAt);
      if (now > expiresAt) {
        // Update status to expired
        await transactionRepository.updateStatus(transactionReference, 'expired');
        transaction.status = 'expired';
      }
    }

    return transaction;
  }

  /**
   * Verify payment status from Paystack
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object>} Updated transaction status
   */
  async verifyPayment(transactionReference) {
    const transaction = await transactionRepository.findByReference(transactionReference);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (!transaction.paystackReference) {
      throw new AppError('Transaction does not have a Paystack reference', 400);
    }

    try {
      const verificationResult = await paystackService.verifyTransaction(
        transaction.paystackReference
      );

      // Map Paystack status to our transaction status
      let status = transaction.status;
      if (verificationResult.status === 'success') {
        status = 'completed';
      } else if (verificationResult.status === 'failed') {
        status = 'failed';
      } else if (verificationResult.status === 'abandoned') {
        status = 'cancelled';
      } else if (verificationResult.status === 'reversed') {
        status = 'cancelled';
      }

      // Update transaction with verification results
      const updates = {
        status,
        paystackStatus: verificationResult.status,
        paystackGatewayResponse: verificationResult.gatewayResponse,
        paystackChannel: verificationResult.channel,
        paystackPaidAt: verificationResult.paidAt ? new Date(verificationResult.paidAt) : null,
      };

      // Add authorization details if available
      if (verificationResult.authorization) {
        const auth = verificationResult.authorization;
        updates.paystackAuthorizationCode = auth.authorization_code;
        updates.paystackBin = auth.bin;
        updates.paystackLast4 = auth.last4;
        updates.paystackExpMonth = auth.exp_month;
        updates.paystackExpYear = auth.exp_year;
        updates.paystackCardType = auth.card_type;
        updates.paystackBank = auth.bank;
        updates.paystackCountryCode = auth.country_code;
        updates.paystackBrand = auth.brand;
        updates.paystackReusable = auth.reusable || false;
        updates.paystackSignature = auth.signature;
      }

      // Add customer details if available
      if (verificationResult.customer) {
        updates.paystackCustomerId = verificationResult.customer.id?.toString();
      }

      const updatedTransaction = await transactionRepository.update(
        transactionReference,
        updates
      );

      logEvent('payment_verified', {
        transactionReference,
        paystackStatus: verificationResult.status,
        status,
      });

      return updatedTransaction;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to verify payment: ${error.message}`, 500);
    }
  }

  /**
   * Handle Paystack webhook
   * @param {Object} webhookData - Webhook data from Paystack
   * @returns {Promise<Object>} Updated transaction
   */
  async handleWebhook(webhookData) {
    const { event, data } = webhookData;

    if (!event || !data) {
      throw new AppError('Invalid webhook data', 400);
    }

    // Handle different webhook events
    if (event === 'charge.success') {
      return this._handleSuccessfulCharge(data);
    } else if (event === 'charge.failed') {
      return this._handleFailedCharge(data);
    } else if (event === 'charge.dispute.create') {
      return this._handleDispute(data);
    }

    logEvent('paystack_webhook_unhandled', {
      event,
    });

    return null;
  }

  /**
   * Handle successful charge webhook
   * @private
   */
  async _handleSuccessfulCharge(data) {
    const reference = data.reference;
    const transaction = await transactionRepository.findByPaystackReference(reference);

    if (!transaction) {
      logEvent('webhook_transaction_not_found', {
        reference,
      });
      throw new AppError('Transaction not found', 404);
    }

    const updates = {
      status: 'completed',
      paystackStatus: data.status,
      paystackGatewayResponse: data.gateway_response,
      paystackChannel: data.channel,
      paystackPaidAt: data.paid_at ? new Date(data.paid_at) : null,
    };

    if (data.authorization) {
      const auth = data.authorization;
      updates.paystackAuthorizationCode = auth.authorization_code;
      updates.paystackBin = auth.bin;
      updates.paystackLast4 = auth.last4;
      updates.paystackExpMonth = auth.exp_month;
      updates.paystackExpYear = auth.exp_year;
      updates.paystackCardType = auth.card_type;
      updates.paystackBank = auth.bank;
      updates.paystackCountryCode = auth.country_code;
      updates.paystackBrand = auth.brand;
      updates.paystackReusable = auth.reusable || false;
      updates.paystackSignature = auth.signature;
    }

    if (data.customer) {
      updates.paystackCustomerId = data.customer.id?.toString();
    }

    const updatedTransaction = await transactionRepository.update(
      transaction.transactionReference,
      updates
    );

    logEvent('payment_webhook_success', {
      transactionReference: transaction.transactionReference,
      reference,
    });

    return updatedTransaction;
  }

  /**
   * Handle failed charge webhook
   * @private
   */
  async _handleFailedCharge(data) {
    const reference = data.reference;
    const transaction = await transactionRepository.findByPaystackReference(reference);

    if (!transaction) {
      logEvent('webhook_transaction_not_found', {
        reference,
      });
      return null;
    }

    const updates = {
      status: 'failed',
      paystackStatus: data.status,
      paystackGatewayResponse: data.gateway_response,
    };

    await transactionRepository.update(transaction.transactionReference, updates);

    logEvent('payment_webhook_failed', {
      transactionReference: transaction.transactionReference,
      reference,
    });

    return transaction;
  }

  /**
   * Handle dispute webhook
   * @private
   */
  async _handleDispute(data) {
    // Handle disputes if needed
    logEvent('payment_webhook_dispute', {
      disputeData: data,
    });
    return null;
  }

  /**
   * Validate email address
   * @private
   */
  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default new PaymentService();
