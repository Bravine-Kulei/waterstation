import otpRepository from '../repositories/otpRepository.js';
import { logEvent } from '../middleware/logger.js';

/**
 * OTP Expiration Service
 * Handles expired OTP cleanup
 */
class OtpExpirationService {
  /**
   * Mark expired OTPs
   * @returns {Promise<number>} Number of OTPs marked as expired
   */
  async markExpiredOTPs() {
    try {
      const count = await otpRepository.markExpired();
      
      if (count > 0) {
        logEvent('otps_expired', {
          count,
        });
      }

      return count;
    } catch (error) {
      logEvent('expire_otps_error', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Start periodic expiration check
   * @param {number} intervalMs - Interval in milliseconds (default: 60000 = 1 minute)
   */
  startExpirationCheck(intervalMs = 60000) {
    setInterval(async () => {
      try {
        await this.markExpiredOTPs();
      } catch (error) {
        console.error('Failed to check expired OTPs:', error);
      }
    }, intervalMs);

    logEvent('otp_expiration_check_started', {
      intervalMs,
    });
  }
}

export default new OtpExpirationService();
