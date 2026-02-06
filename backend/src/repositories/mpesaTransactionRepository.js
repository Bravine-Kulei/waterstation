import pool from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { logEvent } from '../middleware/logger.js'

/**
 * M-Pesa Transaction Repository
 * Handles all database operations for M-Pesa transactions
 */
class MpesaTransactionRepository {
  /**
   * Create a new M-Pesa transaction
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async create(transactionData) {
    const {
      transactionReference,
      phoneNumber,
      amount,
      liters,
      currency = 'KES',
      status = 'pending',
      checkoutRequestId = null,
      merchantRequestId = null,
      metadata = null,
    } = transactionData

    const client = await pool.connect()
    try {
      const query = `
        INSERT INTO mpesa_transactions (
          transaction_reference,
          phone_number,
          amount,
          liters,
          currency,
          status,
          checkout_request_id,
          merchant_request_id,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `

      const values = [
        transactionReference,
        phoneNumber,
        amount,
        liters,
        currency,
        status,
        checkoutRequestId,
        merchantRequestId,
        metadata ? JSON.stringify(metadata) : null,
      ]

      const result = await client.query(query, values)
      const transaction = this._mapRowToTransaction(result.rows[0])

      logEvent('mpesa_transaction_created', {
        transactionReference,
        phoneNumber,
        amount,
        liters,
      })

      return transaction
    } catch (error) {
      logEvent('mpesa_transaction_create_failed', {
        transactionReference,
        error: error.message,
      })

      if (error.code === '23505') {
        throw new AppError('Transaction reference already exists', 409)
      }

      throw new AppError(`Failed to create M-Pesa transaction: ${error.message}`, 500)
    } finally {
      client.release()
    }
  }

  /**
   * Find transaction by reference
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object|null>} Transaction or null
   */
  async findByReference(transactionReference) {
    const client = await pool.connect()
    try {
      const query = 'SELECT * FROM mpesa_transactions WHERE transaction_reference = $1'
      const result = await client.query(query, [transactionReference])

      if (result.rows.length === 0) {
        return null
      }

      return this._mapRowToTransaction(result.rows[0])
    } catch (error) {
      throw new AppError(`Failed to find M-Pesa transaction: ${error.message}`, 500)
    } finally {
      client.release()
    }
  }

  /**
   * Find transaction by checkout request ID
   * @param {string} checkoutRequestId - Checkout Request ID
   * @returns {Promise<Object|null>} Transaction or null
   */
  async findByCheckoutRequestId(checkoutRequestId) {
    const client = await pool.connect()
    try {
      const query = 'SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1'
      const result = await client.query(query, [checkoutRequestId])

      if (result.rows.length === 0) {
        return null
      }

      return this._mapRowToTransaction(result.rows[0])
    } catch (error) {
      throw new AppError(`Failed to find M-Pesa transaction: ${error.message}`, 500)
    } finally {
      client.release()
    }
  }

  /**
   * Find transaction by M-Pesa receipt number
   * @param {string} mpesaReceiptNumber - M-Pesa receipt number
   * @returns {Promise<Object|null>} Transaction or null
   */
  async findByReceiptNumber(mpesaReceiptNumber) {
    const client = await pool.connect()
    try {
      const query = 'SELECT * FROM mpesa_transactions WHERE mpesa_receipt_number = $1'
      const result = await client.query(query, [mpesaReceiptNumber])

      if (result.rows.length === 0) {
        return null
      }

      return this._mapRowToTransaction(result.rows[0])
    } catch (error) {
      throw new AppError(`Failed to find M-Pesa transaction: ${error.message}`, 500)
    } finally {
      client.release()
    }
  }

  /**
   * Update transaction
   * @param {string} transactionReference - Transaction reference
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated transaction
   */
  async update(transactionReference, updates) {
    const client = await pool.connect()
    try {
      const allowedFields = [
        'status',
        'checkout_request_id',
        'merchant_request_id',
        'mpesa_receipt_number',
        'transaction_date',
        'result_code',
        'result_desc',
        'metadata',
      ]

      const updateFields = []
      const values = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        
        if (allowedFields.includes(dbKey)) {
          if (key === 'metadata' && value !== null) {
            updateFields.push(`${dbKey} = $${paramIndex}`)
            values.push(JSON.stringify(value))
          } else if (value instanceof Date) {
            updateFields.push(`${dbKey} = $${paramIndex}`)
            values.push(value)
          } else {
            updateFields.push(`${dbKey} = $${paramIndex}`)
            values.push(value)
          }
          paramIndex++
        }
      }

      if (updateFields.length === 0) {
        throw new AppError('No valid fields to update', 400)
      }

      values.push(transactionReference)
      const query = `
        UPDATE mpesa_transactions
        SET ${updateFields.join(', ')}
        WHERE transaction_reference = $${paramIndex}
        RETURNING *
      `

      const result = await client.query(query, values)

      if (result.rows.length === 0) {
        throw new AppError('M-Pesa transaction not found', 404)
      }

      const transaction = this._mapRowToTransaction(result.rows[0])

      logEvent('mpesa_transaction_updated', {
        transactionReference,
        updates: Object.keys(updates),
      })

      return transaction
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(`Failed to update M-Pesa transaction: ${error.message}`, 500)
    } finally {
      client.release()
    }
  }

  /**
   * Update transaction status
   * @param {string} transactionReference - Transaction reference
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated transaction
   */
  async updateStatus(transactionReference, status) {
    return this.update(transactionReference, { status })
  }

  /**
   * Mark expired transactions
   * @returns {Promise<number>} Number of transactions marked as expired
   */
  async markExpired() {
    const client = await pool.connect()
    try {
      const query = `
        UPDATE mpesa_transactions
        SET status = 'timeout'
        WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '30 minutes'
        RETURNING transaction_reference
      `

      const result = await client.query(query)
      return result.rows.length
    } catch (error) {
      throw new AppError(`Failed to mark expired M-Pesa transactions: ${error.message}`, 500)
    } finally {
      client.release()
    }
  }

  /**
   * Map database row to transaction object
   * @private
   */
  _mapRowToTransaction(row) {
    return {
      id: row.id,
      transactionReference: row.transaction_reference,
      phoneNumber: row.phone_number,
      amount: parseFloat(row.amount),
      liters: parseFloat(row.liters),
      currency: row.currency || 'KES',
      status: row.status,
      checkoutRequestId: row.checkout_request_id,
      merchantRequestId: row.merchant_request_id,
      mpesaReceiptNumber: row.mpesa_receipt_number,
      transactionDate: row.transaction_date,
      resultCode: row.result_code,
      resultDesc: row.result_desc,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

export default new MpesaTransactionRepository()
