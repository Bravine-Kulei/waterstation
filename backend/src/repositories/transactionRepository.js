import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Transaction Repository
 * Handles all database operations for transactions
 */
class TransactionRepository {
  /**
   * Create a new transaction
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async create(transactionData) {
    const {
      transactionReference,
      email,
      phoneNumber = null,
      amount,
      currency = 'NGN',
      status = 'pending',
      metadata = null,
      expiresAt = null,
    } = transactionData;

    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO transactions (
          transaction_reference,
          email,
          phone_number,
          amount,
          currency,
          status,
          metadata,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        transactionReference,
        email,
        phoneNumber,
        amount,
        currency,
        status,
        metadata ? JSON.stringify(metadata) : null,
        expiresAt,
      ];

      const result = await client.query(query, values);
      const transaction = this._mapRowToTransaction(result.rows[0]);

      logEvent('transaction_created', {
        transactionReference,
        email,
        amount,
        currency,
      });

      return transaction;
    } catch (error) {
      logEvent('transaction_create_failed', {
        transactionReference,
        error: error.message,
      });

      if (error.code === '23505') {
        // Unique constraint violation
        throw new AppError('Transaction reference already exists', 409);
      }

      throw new AppError(`Failed to create transaction: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find transaction by reference
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object|null>} Transaction or null
   */
  async findByReference(transactionReference) {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM transactions WHERE transaction_reference = $1';
      const result = await client.query(query, [transactionReference]);

      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToTransaction(result.rows[0]);
    } catch (error) {
      throw new AppError(`Failed to find transaction: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find transaction by Paystack reference
   * @param {string} paystackReference - Paystack reference
   * @returns {Promise<Object|null>} Transaction or null
   */
  async findByPaystackReference(paystackReference) {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM transactions WHERE paystack_reference = $1';
      const result = await client.query(query, [paystackReference]);

      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToTransaction(result.rows[0]);
    } catch (error) {
      throw new AppError(`Failed to find transaction: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }


  /**
   * Update transaction
   * @param {string} transactionReference - Transaction reference
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated transaction
   */
  async update(transactionReference, updates) {
    const client = await pool.connect();
    try {
      const allowedFields = [
        'status',
        'email',
        'phone_number',
        'currency',
        'paystack_reference',
        'paystack_access_code',
        'paystack_authorization_url',
        'paystack_status',
        'paystack_gateway_response',
        'paystack_channel',
        'paystack_customer_id',
        'paystack_authorization_code',
        'paystack_bin',
        'paystack_last4',
        'paystack_exp_month',
        'paystack_exp_year',
        'paystack_card_type',
        'paystack_bank',
        'paystack_country_code',
        'paystack_brand',
        'paystack_reusable',
        'paystack_signature',
        'paystack_paid_at',
        'metadata',
      ];

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        // Convert camelCase to snake_case for database fields
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(dbKey)) {
          if (key === 'metadata' && value !== null) {
            updateFields.push(`${dbKey} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else if (value instanceof Date) {
            updateFields.push(`${dbKey} = $${paramIndex}`);
            values.push(value);
          } else {
            updateFields.push(`${dbKey} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      values.push(transactionReference);
      const query = `
        UPDATE transactions
        SET ${updateFields.join(', ')}
        WHERE transaction_reference = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new AppError('Transaction not found', 404);
      }

      const transaction = this._mapRowToTransaction(result.rows[0]);

      logEvent('transaction_updated', {
        transactionReference,
        updates: Object.keys(updates),
      });

      return transaction;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to update transaction: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Update transaction status
   * @param {string} transactionReference - Transaction reference
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated transaction
   */
  async updateStatus(transactionReference, status) {
    return this.update(transactionReference, { status });
  }

  /**
   * Map database row to transaction object
   * @private
   */
  _mapRowToTransaction(row) {
    return {
      id: row.id,
      transactionReference: row.transaction_reference,
      email: row.email,
      phoneNumber: row.phone_number,
      amount: parseFloat(row.amount),
      currency: row.currency || 'NGN',
      status: row.status,
      paystackReference: row.paystack_reference,
      paystackAccessCode: row.paystack_access_code,
      paystackAuthorizationUrl: row.paystack_authorization_url,
      paystackStatus: row.paystack_status,
      paystackGatewayResponse: row.paystack_gateway_response,
      paystackChannel: row.paystack_channel,
      paystackCustomerId: row.paystack_customer_id,
      paystackAuthorizationCode: row.paystack_authorization_code,
      paystackBin: row.paystack_bin,
      paystackLast4: row.paystack_last4,
      paystackExpMonth: row.paystack_exp_month,
      paystackExpYear: row.paystack_exp_year,
      paystackCardType: row.paystack_card_type,
      paystackBank: row.paystack_bank,
      paystackCountryCode: row.paystack_country_code,
      paystackBrand: row.paystack_brand,
      paystackReusable: row.paystack_reusable || false,
      paystackSignature: row.paystack_signature,
      paystackPaidAt: row.paystack_paid_at,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }
}

export default new TransactionRepository();
