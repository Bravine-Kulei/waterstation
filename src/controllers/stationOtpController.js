import stationOtpService from '../services/stationOtpService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Station OTP Controller
 * Handles HTTP requests for station OTP verification
 * 
 * Request/Response Contracts:
 * 
 * POST /api/stations/otp/verify
 * Request Body:
 *   {
 *     "transactionReference": "string (required)",
 *     "otp": "string (required, 6 digits)",
 *     "stationId": "string (required)"
 *   }
 * 
 * Success Response (200):
 *   {
 *     "success": true,
 *     "message": "OTP verified successfully. Dispensing authorized.",
 *     "data": {
 *       "transactionReference": "string",
 *       "stationId": "string",
 *       "liters": number,
 *       "pulses": number,
 *       "status": "in_progress",
 *       "verifiedAt": "ISO timestamp"
 *     }
 *   }
 * 
 * Error Responses:
 *   400 - Invalid OTP, expired, blocked, or validation error
 *   403 - OTP locked to different station
 *   404 - OTP not found
 *   409 - OTP already in use at different station
 */
class StationOtpController {
  /**
   * Verify OTP for station dispensing
   * POST /api/stations/otp/verify
   */
  async verifyOTP(req, res, next) {
    try {
      const { transactionReference, otp, stationId } = req.body;

      // Validate required fields
      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400);
      }

      if (!otp) {
        throw new AppError('OTP is required', 400);
      }

      if (!stationId) {
        throw new AppError('Station ID is required', 400);
      }

      // Validate OTP format
      if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new AppError('OTP must be a 6-digit number', 400);
      }

      // Verify OTP
      const result = await stationOtpService.verifyOTPForStation({
        transactionReference,
        otp,
        stationId,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          transactionReference: result.transactionReference,
          stationId: result.stationId,
          liters: result.liters,
          pulses: result.pulses,
          status: result.status,
          verifiedAt: result.verifiedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get OTP status for a station
   * GET /api/stations/otp/status/:transactionReference
   * Query params: stationId (required)
   * 
   * Success Response (200):
   *   {
   *     "success": true,
   *     "data": {
   *       "exists": boolean,
   *       "status": "active" | "in_progress" | "used" | "expired" | "blocked" | null,
   *       "liters": number,
   *       "pulses": number,
   *       "expiresAt": "ISO timestamp",
   *       "attempts": number,
   *       "maxAttempts": number,
   *       "remainingAttempts": number,
   *       "stationId": "string" | null,
   *       "isLockedToDifferentStation": boolean,
   *       "canUse": boolean
   *     }
   *   }
   */
  async getOTPStatus(req, res, next) {
    try {
      const { transactionReference } = req.params;
      const { stationId } = req.query;

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400);
      }

      if (!stationId) {
        throw new AppError('Station ID is required as query parameter', 400);
      }

      const status = await stationOtpService.getOTPStatusForStation(
        transactionReference,
        stationId
      );

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StationOtpController();
