import express from 'express';
import otpController from '../controllers/otpController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   POST /api/otp/generate
 * @desc    Generate OTP for a completed transaction
 * @access  Public (should be protected in production)
 */
router.post(
  '/generate',
  asyncHandler(otpController.generateOTP.bind(otpController))
);

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP
 * @access  Public (should be protected in production)
 */
router.post(
  '/verify',
  asyncHandler(otpController.verifyOTP.bind(otpController))
);

/**
 * @route   GET /api/otp/status/:transactionReference
 * @desc    Get OTP status for a transaction
 * @access  Public (should be protected in production)
 */
router.get(
  '/status/:transactionReference',
  asyncHandler(otpController.getOTPStatus.bind(otpController))
);

export default router;
