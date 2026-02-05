import express from 'express';
import healthRoutes from './healthRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import otpRoutes from './otpRoutes.js';
import stationRoutes from './stationRoutes.js';

const router = express.Router();

// Health check route
router.use('/health', healthRoutes);

// Payment routes
router.use('/payments', paymentRoutes);

// OTP routes (for customer-facing OTP generation/verification)
router.use('/otp', otpRoutes);

// Station routes (for dispensing station OTP verification)
router.use('/stations', stationRoutes);

export default router;
