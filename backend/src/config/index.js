import dotenv from 'dotenv';
import { databaseConfig, validateDatabaseConfig } from './database.config.js';
import { redisConfig, validateRedisConfig } from './redis.config.js';
import { paystackConfig, validatePaystackConfig } from './paystack.config.js';
import { otpConfig, validateOtpConfig } from './otp.config.js';
import { stationConfig, validateStationConfig } from './station.config.js';
import { appConfig, validateAppConfig } from './app.config.js';

// Load environment variables once at the top level
dotenv.config();

/**
 * Centralized configuration export
 * All configuration is loaded from environment variables
 */
export const config = {
  app: appConfig,
  database: databaseConfig,
  redis: redisConfig,
  paystack: paystackConfig,
  otp: otpConfig,
  station: stationConfig,
};

/**
 * Validate all configuration
 * Call this during application startup
 * @throws {Error} If any configuration is invalid
 */
export function validateConfig() {
  try {
    validateAppConfig();
    validateDatabaseConfig();
    validateRedisConfig();
    validatePaystackConfig();
    validateOtpConfig();
    validateStationConfig();
    console.log('Configuration validated successfully');
  } catch (error) {
    console.error('Configuration validation failed:', error.message);
    throw error;
  }
}

// Export individual configs for convenience
export { databaseConfig, validateDatabaseConfig } from './database.config.js';
export { redisConfig, validateRedisConfig } from './redis.config.js';
export { paystackConfig, validatePaystackConfig } from './paystack.config.js';
export { otpConfig, validateOtpConfig } from './otp.config.js';
export { stationConfig, validateStationConfig } from './station.config.js';
export { appConfig, validateAppConfig, isProduction, isDevelopment } from './app.config.js';

export default config;
