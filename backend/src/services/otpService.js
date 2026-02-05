import otpRepository from '../repositories/otpRepository.js';
import transactionRepository from '../repositories/transactionRepository.js';
import redisClient from '../config/redis.js';
import { generateOTP, hashOTP, verifyOTP } from '../utils/otpGenerator.js';
import { otpConfig } from '../config/otp.config.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * OTP Service
 * Handles OTP business logic including generation, validation, and caching
 */
class OtpService {
  /**
   * Generate and store OTP for a transaction
   * @param {Object} params - OTP parameters
   * @param {string} params.transactionReference - Transaction reference
   * @param {number} params.liters - Liters purchased
   * @returns {Promise<Object>} OTP generation result (without the actual OTP)
   */
  async generateOTP(params) {
    const { transactionReference, liters } = params;

    // Validate transaction exists and is completed
    const transaction = await transactionRepository.findByReference(transactionReference);
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (transaction.status !== 'completed') {
      throw new AppError('OTP can only be generated for completed transactions', 400);
    }

    // Check if active OTP already exists
    const existingOtp = await otpRepository.findActiveByTransaction(transactionReference);
    if (existingOtp) {
      // Invalidate existing OTP
      await otpRepository.update(existingOtp.id, { status: 'expired' });
    }

    // Generate secure OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + otpConfig.expirationMinutes);

    // Store OTP in database
    const otpRecord = await otpRepository.create({
      transactionReference,
      otpHash,
      liters,
      expiresAt,
      maxAttempts: otpConfig.maxAttempts,
    });

    // Cache OTP in Redis for fast lookup (store hash, not plain OTP)
    if (otpConfig.cacheEnabled && redisClient.isOpen) {
      try {
        const cacheKey = this._getCacheKey(transactionReference);
        const cacheData = {
          otpHash,
          liters,
          expiresAt: expiresAt.toISOString(),
          attempts: 0,
        };
        
        await redisClient.setEx(
          cacheKey,
          otpConfig.cacheTtlSeconds,
          JSON.stringify(cacheData)
        );
      } catch (redisError) {
        // Log but don't fail - database is source of truth
        logEvent('otp_cache_failed', {
          transactionReference,
          error: redisError.message,
        });
      }
    }

    logEvent('otp_generated', {
      transactionReference,
      liters,
      expiresAt,
    });

    // Return OTP (only time it's returned in plain text)
    return {
      otp,
      transactionReference,
      liters,
      expiresAt,
      expiresInMinutes: otpConfig.expirationMinutes,
    };
  }

  /**
   * Verify OTP
   * @param {Object} params - Verification parameters
   * @param {string} params.transactionReference - Transaction reference
   * @param {string} params.otp - OTP to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyOTP(params) {
    const { transactionReference, otp } = params;

    // Try to get from cache first
    let otpRecord = null;
    if (otpConfig.cacheEnabled && redisClient.isOpen) {
      try {
        const cacheKey = this._getCacheKey(transactionReference);
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
          const cache = JSON.parse(cachedData);
          otpRecord = {
            otpHash: cache.otpHash,
            liters: cache.liters,
            expiresAt: new Date(cache.expiresAt),
            attempts: cache.attempts,
            status: 'active',
          };
        }
      } catch (redisError) {
        // Fall back to database
        logEvent('otp_cache_read_failed', {
          transactionReference,
          error: redisError.message,
        });
      }
    }

    // If not in cache, get from database
    if (!otpRecord) {
      otpRecord = await otpRepository.findActiveByTransaction(transactionReference);
    }

    if (!otpRecord) {
      throw new AppError('OTP not found or expired', 404);
    }

    // Check if OTP is expired
    const now = new Date();
    if (new Date(otpRecord.expiresAt) <= now) {
      // Mark as expired in database
      if (otpRecord.id) {
        await otpRepository.update(otpRecord.id, { status: 'expired' });
      }
      
      // Remove from cache
      if (otpConfig.cacheEnabled && redisClient.isOpen) {
        try {
          const cacheKey = this._getCacheKey(transactionReference);
          await redisClient.del(cacheKey);
        } catch (error) {
          // Ignore cache errors
        }
      }

      throw new AppError('OTP has expired', 400);
    }

    // Check if OTP is already used
    if (otpRecord.status === 'used') {
      throw new AppError('OTP has already been used', 400);
    }

    // Check if OTP is blocked (too many attempts)
    if (otpRecord.status === 'blocked') {
      throw new AppError('OTP has been blocked due to too many failed attempts', 400);
    }

    // Verify OTP
    const isValid = verifyOTP(otp, otpRecord.otpHash);

    if (!isValid) {
      // Increment attempt count
      if (otpRecord.id) {
        const updatedOtp = await otpRepository.incrementAttempts(otpRecord.id);
        
        // Update cache
        if (otpConfig.cacheEnabled && redisClient.isOpen && updatedOtp) {
          try {
            const cacheKey = this._getCacheKey(transactionReference);
            const cacheData = {
              otpHash: updatedOtp.otpHash,
              liters: updatedOtp.liters,
              expiresAt: updatedOtp.expiresAt.toISOString(),
              attempts: updatedOtp.attempts,
            };
            await redisClient.setEx(
              cacheKey,
              otpConfig.cacheTtlSeconds,
              JSON.stringify(cacheData)
            );
          } catch (error) {
            // Ignore cache errors
          }
        }

        // Check if blocked after increment
        if (updatedOtp.status === 'blocked') {
          throw new AppError('OTP has been blocked due to too many failed attempts', 400);
        }
      }

      logEvent('otp_verification_failed', {
        transactionReference,
        attempts: otpRecord.attempts + 1,
      });

      throw new AppError('Invalid OTP', 400);
    }

    // OTP is valid - mark as used
    if (otpRecord.id) {
      await otpRepository.markAsUsed(otpRecord.id);
    }

    // Remove from cache
    if (otpConfig.cacheEnabled && redisClient.isOpen) {
      try {
        const cacheKey = this._getCacheKey(transactionReference);
        await redisClient.del(cacheKey);
      } catch (error) {
        // Ignore cache errors
      }
    }

    logEvent('otp_verified', {
      transactionReference,
      liters: otpRecord.liters,
    });

    return {
      valid: true,
      transactionReference,
      liters: otpRecord.liters,
      message: 'OTP verified successfully',
    };
  }

  /**
   * Get OTP status (without revealing the OTP)
   * @param {string} transactionReference - Transaction reference
   * @returns {Promise<Object>} OTP status
   */
  async getOTPStatus(transactionReference) {
    const otp = await otpRepository.findActiveByTransaction(transactionReference);

    if (!otp) {
      return {
        exists: false,
        status: null,
      };
    }

    const now = new Date();
    const expiresAt = new Date(otp.expiresAt);
    const isExpired = expiresAt <= now;

    return {
      exists: true,
      status: isExpired ? 'expired' : otp.status,
      expiresAt: otp.expiresAt,
      attempts: otp.attempts,
      maxAttempts: otp.maxAttempts,
      liters: otp.liters,
      remainingAttempts: otp.maxAttempts - otp.attempts,
    };
  }

  /**
   * Get Redis cache key for OTP
   * @private
   */
  _getCacheKey(transactionReference) {
    return `otp:${transactionReference}`;
  }
}

export default new OtpService();
