import otpService from '../services/otpService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * OTP Controller
 * Handles HTTP requests for OTP operations
 */
class OtpController {
  /**
   * Generate OTP for a transaction
   * POST /api/otp/generate
   */
  async generateOTP(req, res, next) {
    try {
      const { transactionReference, liters } = req.body;

      if (!transactionReference || !liters) {
        throw new AppError('Transaction reference and liters are required', 400);
      }

      if (typeof liters !== 'number' || liters <= 0) {
        throw new AppError('Liters must be a positive number', 400);
      }

      const result = await otpService.generateOTP({
        transactionReference,
        liters: parseFloat(liters),
      });

      res.status(201).json({
        success: true,
        message: 'OTP generated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP
   * POST /api/otp/verify
   */
  async verifyOTP(req, res, next) {
    try {
      const { transactionReference, otp } = req.body;

      if (!transactionReference || !otp) {
        throw new AppError('Transaction reference and OTP are required', 400);
      }

      if (typeof otp !== 'string' || otp.length !== 6) {
        throw new AppError('OTP must be a 6-digit string', 400);
      }

      const result = await otpService.verifyOTP({
        transactionReference,
        otp,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          transactionReference: result.transactionReference,
          liters: result.liters,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get OTP status
   * GET /api/otp/status/:transactionReference
   */
  async getOTPStatus(req, res, next) {
    try {
      const { transactionReference } = req.params;

      if (!transactionReference) {
        throw new AppError('Transaction reference is required', 400);
      }

      const status = await otpService.getOTPStatus(transactionReference);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new OtpController();
