import paymentService from '../services/paymentService.js';
import paystackService from '../services/paystackService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Payment Controller
 * Handles HTTP requests for payment operations using Paystack
 */
class PaymentController {
  /**
   * Initiate payment (Paystack checkout)
   * POST /api/payments/initialize
   */
  async initializePayment(req, res, next) {
    try {
      const { email, amount, currency, description, phoneNumber, metadata } = req.body;

      if (!email || !amount) {
        throw new AppError('Email and amount are required', 400);
      }

      const result = await paymentService.initiatePayment({
        email,
        amount,
        currency,
        description,
        phoneNumber,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: 'Payment checkout initialized successfully. Redirect customer to authorizationUrl.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction status
   * GET /api/payments/status/:transactionReference
   */
  async getTransactionStatus(req, res, next) {
    try {
      const { transactionReference } = req.params;

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400);
      }

      const transaction = await paymentService.getTransactionStatus(transactionReference);

      res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify payment status from Paystack
   * GET /api/payments/verify/:transactionReference
   */
  async verifyPayment(req, res, next) {
    try {
      const { transactionReference } = req.params;

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400);
      }

      const transaction = await paymentService.verifyPayment(transactionReference);

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Paystack callback (redirect) endpoint
   * GET /api/payments/callback
   *
   * Paystack typically redirects the customer's browser to this URL after payment.
   * This is NOT the webhook (server-to-server). Webhook is POST /api/payments/webhook.
   *
   * Paystack may include `reference` and/or `trxref` as query params.
   */
  async handleCallback(req, res, next) {
    try {
      const reference = req.query.reference || req.query.trxref;

      if (!reference || typeof reference !== 'string') {
        throw new AppError('Missing payment reference in callback query params', 400);
      }

      // We don't auto-verify here to keep the callback fast and resilient.
      // Client can call GET /api/payments/verify/:transactionReference (reference == our transactionReference).
      res.status(200).json({
        success: true,
        message: 'Payment callback received. Verify payment to confirm final status.',
        data: {
          reference,
          verifyUrl: `/api/payments/verify/${encodeURIComponent(reference)}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Paystack webhook
   * POST /api/payments/webhook
   * 
   * Paystack sends webhooks with X-Paystack-Signature header for verification
   * The raw body (Buffer) is needed for signature verification
   */
  async handleWebhook(req, res, next) {
    // Store raw body for logging and verification
    // req.body is a Buffer when using express.raw()
    const rawBody = req.body;
    const rawBodyString = rawBody.toString('utf8');

    try {
      // Log raw webhook payload for auditing
      logEvent('paystack_webhook_received', {
        rawPayload: rawBodyString,
        timestamp: new Date().toISOString(),
      });

      // Parse JSON body
      let webhookData;
      try {
        webhookData = JSON.parse(rawBodyString);
      } catch (parseError) {
        logEvent('paystack_webhook_parse_error', {
          error: parseError.message,
        });
        throw new AppError('Invalid webhook payload format', 400);
      }

      // Get signature from headers
      const signature = req.headers['x-paystack-signature'];

      // Verify webhook signature (use raw body Buffer for verification)
      if (signature) {
        const isValid = paystackService.verifyWebhookSignature(signature, rawBody);
        if (!isValid) {
          logEvent('paystack_webhook_invalid_signature', {
            signature: signature.substring(0, 20) + '...', // Log partial signature for debugging
          });
          throw new AppError('Invalid webhook signature', 401);
        }
      } else {
        // In test mode, signature might not be present
        // In production, this should be required
        logEvent('paystack_webhook_no_signature', {
          warning: 'Webhook received without signature header',
        });
      }

      // Process webhook
      const result = await paymentService.handleWebhook(webhookData);

      // Paystack expects a 200 response
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });

      logEvent('paystack_webhook_processed', {
        event: webhookData.event,
        reference: webhookData.data?.reference,
      });
    } catch (error) {
      // Log error but still return 200 to Paystack
      // We don't want Paystack to keep retrying if it's our error
      logEvent('paystack_webhook_processing_error', {
        error: error.message,
        rawPayload: rawBodyString.substring(0, 500), // Log first 500 chars
      });

      console.error('Paystack webhook processing error:', error);

      // Return 200 to Paystack (they may retry based on their logic)
      res.status(200).json({
        success: false,
        message: error.message || 'Webhook processing failed',
      });
    }
  }
}

export default new PaymentController();
