import otpRepository from '../repositories/otpRepository.js';
import { verifyOTP } from '../utils/otpGenerator.js';
import { stationConfig } from '../config/station.config.js';
import { AppError } from '../middleware/errorHandler.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Station OTP Service
 * Handles OTP verification for dispensing stations
 */
class StationOtpService {
  /**
   * Verify OTP for station dispensing
   * @param {Object} params - Verification parameters
   * @param {string} params.transactionReference - Transaction reference
   * @param {string} params.otp - OTP to verify
   * @param {string} params.stationId - Station ID attempting verification
   * @returns {Promise<Object>} Verification result with liters and pulses
   */
  async verifyOTPForStation(params) {
    const { transactionReference, otp, stationId } = params;

    // Validate inputs
    if (!transactionReference || !otp || !stationId) {
      throw new AppError('Transaction reference, OTP, and station ID are required', 400);
    }

    if (typeof otp !== 'string' || otp.length !== 6) {
      throw new AppError('OTP must be a 6-digit string', 400);
    }

    // Find active OTP
    const otpRecord = await otpRepository.findActiveByTransaction(transactionReference);

    if (!otpRecord) {
      throw new AppError('OTP not found or expired', 404);
    }

    // Check if OTP is expired
    const now = new Date();
    if (new Date(otpRecord.expiresAt) <= now) {
      await otpRepository.update(otpRecord.id, { status: 'expired' });
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

    // Check station locking (if enabled)
    if (stationConfig.enforceStationLock && otpRecord.stationId) {
      if (otpRecord.stationId !== stationId) {
        throw new AppError(
          `OTP is locked to station ${otpRecord.stationId} and cannot be used at station ${stationId}`,
          403
        );
      }
    }

    // Check if OTP is already in progress at a different station
    if (otpRecord.status === 'in_progress' && otpRecord.stationId !== stationId) {
      throw new AppError(
        `OTP is already in use at station ${otpRecord.stationId}`,
        409
      );
    }

    // Verify OTP
    const isValid = verifyOTP(otp, otpRecord.otpHash);

    if (!isValid) {
      // Increment attempt count
      const updatedOtp = await otpRepository.incrementAttempts(otpRecord.id);

      logEvent('station_otp_verification_failed', {
        transactionReference,
        stationId,
        attempts: updatedOtp.attempts,
        maxAttempts: updatedOtp.maxAttempts,
      });

      // Check if blocked after increment
      if (updatedOtp.status === 'blocked') {
        throw new AppError(
          'OTP has been blocked due to too many failed attempts',
          400
        );
      }

      const remainingAttempts = updatedOtp.maxAttempts - updatedOtp.attempts;
      throw new AppError(
        `Invalid OTP. ${remainingAttempts} attempt(s) remaining`,
        400
      );
    }

    // OTP is valid - mark as in progress
    const inProgressOtp = await otpRepository.markInProgress(otpRecord.id, stationId);

    // Calculate pulses (hardware-specific)
    const pulses = Math.round(otpRecord.liters * stationConfig.pulsesPerLiter);

    logEvent('station_otp_verified', {
      transactionReference,
      stationId,
      liters: otpRecord.liters,
      pulses,
    });

    return {
      success: true,
      transactionReference,
      stationId,
      liters: otpRecord.liters,
      pulses,
      status: 'in_progress',
      verifiedAt: inProgressOtp.verifiedAt,
      message: 'OTP verified successfully. Dispensing authorized.',
    };
  }

  /**
   * Get OTP status for a station
   * @param {string} transactionReference - Transaction reference
   * @param {string} stationId - Station ID
   * @returns {Promise<Object>} OTP status
   */
  async getOTPStatusForStation(transactionReference, stationId) {
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

    // Check if locked to different station
    const isLockedToDifferentStation =
      stationConfig.enforceStationLock &&
      otp.stationId &&
      otp.stationId !== stationId;

    return {
      exists: true,
      status: isExpired ? 'expired' : otp.status,
      liters: otp.liters,
      pulses: Math.round(otp.liters * stationConfig.pulsesPerLiter),
      expiresAt: otp.expiresAt,
      attempts: otp.attempts,
      maxAttempts: otp.maxAttempts,
      remainingAttempts: otp.maxAttempts - otp.attempts,
      stationId: otp.stationId,
      isLockedToDifferentStation,
      canUse: !isExpired && 
              otp.status !== 'used' && 
              otp.status !== 'blocked' && 
              !isLockedToDifferentStation,
    };
  }
}

export default new StationOtpService();
