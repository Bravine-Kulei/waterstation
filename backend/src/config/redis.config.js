import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis configuration
 * All Redis-related settings loaded from environment variables
 */
export const redisConfig = {
  url: process.env.REDIS_URL || (() => {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    return `redis://${host}:${port}`;
  })(),
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (retries) => {
      const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10);
      if (retries > maxRetries) {
        // Stop reconnecting after max retries
        return false;
      }
      const baseDelay = parseInt(process.env.REDIS_RECONNECT_BASE_DELAY || '100', 10);
      const maxDelay = parseInt(process.env.REDIS_RECONNECT_MAX_DELAY || '3000', 10);
      return Math.min(retries * baseDelay, maxDelay);
    },
  },
};

/**
 * Validate required Redis configuration
 * @throws {Error} If required configuration is missing
 */
export function validateRedisConfig() {
  // Redis URL is always generated, so no validation needed
  // But we can validate if custom host/port are provided
  if (process.env.REDIS_HOST && !process.env.REDIS_PORT) {
    throw new Error('REDIS_PORT is required when REDIS_HOST is provided');
  }
}
