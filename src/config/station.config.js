import dotenv from 'dotenv';

dotenv.config();

/**
 * Station Configuration
 * Configuration for water dispensing stations
 */
export const stationConfig = {
  // Pulses per liter (how many pulses = 1 liter)
  // This is hardware-specific and may vary by station
  pulsesPerLiter: parseInt(process.env.STATION_PULSES_PER_LITER || '1000', 10),
  
  // Whether to enforce station locking (OTP can only be used at one station)
  enforceStationLock: process.env.STATION_ENFORCE_LOCK !== 'false', // Default: true
  
  // Station authentication (if stations need to authenticate)
  requireStationAuth: process.env.STATION_REQUIRE_AUTH === 'true', // Default: false
};

/**
 * Validate station configuration
 * @throws {Error} If configuration is invalid
 */
export function validateStationConfig() {
  if (stationConfig.pulsesPerLiter < 1 || stationConfig.pulsesPerLiter > 10000) {
    throw new Error('STATION_PULSES_PER_LITER must be between 1 and 10000');
  }
}
