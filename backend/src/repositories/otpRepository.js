import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * OTP Repository
 * Handles all database operations for OTPs
 */
class OtpRepository {
  /**
   * Create a new OTP
   * @param {Object} otpData - OTP data
   * @returns {Promise<Object>} Created OTP
   */
  async create(otpData) {
    const {
      transactionReference,
      otpHash,
      liters,
      expiresAt,
      maxAttempts = 3,
    } = otpData;

    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO otps (
          transaction_reference,
          otp_hash,
          liters,
          expires_at,
          max_attempts
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        transactionReference,
        otpHash,
        liters,
        expiresAt,
        maxAttempts,
      ];

      const result = await client.query(query, values);
      const otp = this._mapRowToOtp(result.rows[0]);

      logEvent('otp_created', {
        transactionReference,
        liters,
        expiresAt,
      });

      return otp;
    } catch (error) {
      logEvent('otp_create_failed', {
        transactionReference,
        error: error.message,
      });

      if (error.code === '23505') {
        // Unique constraint violation (if we add unique constraint)
        throw new AppError('OTP already exists for this transaction', 409);
      }

      throw new AppError(`Failed to create OTP: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find active OTP by transaction reference
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object|null>} OTP or null
   */
  async findActiveByTransaction(transactionReference) {
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM otps 
        WHERE transaction_reference = $1 
        AND status IN ('active', 'in_progress')
        AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const result = await client.query(query, [transactionReference]);

      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToOtp(result.rows[0]);
    } catch (error) {
      throw new AppError(`Failed to find OTP: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Find OTP by ID
   * @param {number} id - OTP ID
   * @returns {Promise<Object|null>} OTP or null
   */
  async findById(id) {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM otps WHERE id = $1';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this._mapRowToOtp(result.rows[0]);
    } catch (error) {
      throw new AppError(`Failed to find OTP: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Update OTP
   * @param {number} id - OTP ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated OTP
   */
  async update(id, updates) {
    const client = await pool.connect();
    try {
      const allowedFields = [
        'status',
        'attempts',
        'used_at',
        'verified_at',
        'station_id',
      ];

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(dbKey)) {
          updateFields.push(`${dbKey} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      values.push(id);
      const query = `
        UPDATE otps
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new AppError('OTP not found', 404);
      }

      const otp = this._mapRowToOtp(result.rows[0]);

      logEvent('otp_updated', {
        otpId: id,
        updates: Object.keys(updates),
      });

      return otp;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to update OTP: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Mark OTP as in progress (claimed by station)
   * @param {number} id - OTP ID
   * @param {string} stationId - Station ID claiming the OTP
   * @returns {Promise<Object>} Updated OTP
   */
  async markInProgress(id, stationId) {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE otps
        SET status = 'in_progress',
            station_id = $1,
            verified_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await client.query(query, [stationId, id]);

      if (result.rows.length === 0) {
        throw new AppError('OTP not found', 404);
      }

      return this._mapRowToOtp(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to mark OTP as in progress: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Mark OTP as used
   * @param {number} id - OTP ID
   * @returns {Promise<Object>} Updated OTP
   */
  async markAsUsed(id) {
    return this.update(id, {
      status: 'used',
      usedAt: new Date(),
    });
  }

  /**
   * Increment attempt count
   * @param {number} id - OTP ID
   * @returns {Promise<Object>} Updated OTP
   */
  async incrementAttempts(id) {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE otps
        SET attempts = attempts + 1,
            status = CASE 
              WHEN attempts + 1 >= max_attempts THEN 'blocked'
              ELSE status
            END
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        throw new AppError('OTP not found', 404);
      }

      return this._mapRowToOtp(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to increment attempts: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Mark expired OTPs
   * @returns {Promise<number>} Number of OTPs marked as expired
   */
  async markExpired() {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE otps
        SET status = 'expired'
        WHERE status = 'active'
        AND expires_at <= NOW()
        RETURNING id
      `;

      const result = await client.query(query);
      return result.rows.length;
    } catch (error) {
      throw new AppError(`Failed to mark expired OTPs: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to OTP object
   * @private
   */
  _mapRowToOtp(row) {
    return {
      id: row.id,
      transactionReference: row.transaction_reference,
      otpHash: row.otp_hash,
      liters: parseFloat(row.liters),
      status: row.status,
      stationId: row.station_id,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      usedAt: row.used_at,
      verifiedAt: row.verified_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new OtpRepository();
