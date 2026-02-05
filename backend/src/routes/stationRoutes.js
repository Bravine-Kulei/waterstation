import express from 'express';
import stationOtpController from '../controllers/stationOtpController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @route   POST /api/stations/otp/verify
 * @desc    Verify OTP for water dispensing
 * @access  Public (should be protected with station authentication in production)
 * 
 * Request Body:
 *   {
 *     "transactionReference": "TXN123456789",
 *     "otp": "123456",
 *     "stationId": "STATION001"
 *   }
 * 
 * Success Response:
 *   {
 *     "success": true,
 *     "message": "OTP verified successfully. Dispensing authorized.",
 *     "data": {
 *       "transactionReference": "TXN123456789",
 *       "stationId": "STATION001",
 *       "liters": 10.5,
 *       "pulses": 10500,
 *       "status": "in_progress",
 *       "verifiedAt": "2024-01-01T12:00:00.000Z"
 *     }
 *   }
 */
router.post(
  '/otp/verify',
  asyncHandler(stationOtpController.verifyOTP.bind(stationOtpController))
);

/**
 * @route   GET /api/stations/otp/status/:transactionReference
 * @desc    Get OTP status for a transaction
 * @access  Public (should be protected with station authentication in production)
 * 
 * Query Parameters:
 *   - stationId (required): Station ID checking the status
 * 
 * Example:
 *   GET /api/stations/otp/status/TXN123456789?stationId=STATION001
 */
router.get(
  '/otp/status/:transactionReference',
  asyncHandler(stationOtpController.getOTPStatus.bind(stationOtpController))
);

export default router;
