import pool from '../config/database.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Transaction Timeout Service
 * Handles expired transaction cleanup
 */
class TransactionTimeoutService {
  /**
   * Mark expired transactions as expired
   * @returns {Promise<number>} Number of transactions updated
   */
  async markExpiredTransactions() {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE transactions
        SET status = 'expired'
        WHERE status = 'pending'
        AND expires_at < NOW()
        RETURNING transaction_reference
      `;

      const result = await client.query(query);
      const count = result.rows.length;

      if (count > 0) {
        logEvent('transactions_expired', {
          count,
          transactionReferences: result.rows.map((r) => r.transaction_reference),
        });
      }

      return count;
    } catch (error) {
      logEvent('expire_transactions_error', {
        error: error.message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start periodic expiration check
   * @param {number} intervalMs - Interval in milliseconds (default: 60000 = 1 minute)
   */
  startExpirationCheck(intervalMs = 60000) {
    setInterval(async () => {
      try {
        await this.markExpiredTransactions();
      } catch (error) {
        console.error('Failed to check expired transactions:', error);
      }
    }, intervalMs);

    logEvent('expiration_check_started', {
      intervalMs,
    });
  }
}

export default new TransactionTimeoutService();
