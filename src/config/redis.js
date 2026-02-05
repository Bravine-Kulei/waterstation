import { createClient } from 'redis';
import { redisConfig } from './redis.config.js';

/**
 * Redis client configuration
 * Uses centralized configuration from redis.config.js
 */
const redisClient = createClient({
  url: redisConfig.url,
  password: redisConfig.password,
  socket: redisConfig.socket,
});

// Track connection state
let isConnecting = false;
let connectionAttempts = 0;
let hasConnectedOnce = false;

// Handle connection errors (only log if we've connected before or are actively trying)
redisClient.on('error', (err) => {
  // Only log errors if we've successfully connected before (reconnection errors)
  // or if we're in the process of connecting
  if (hasConnectedOnce || isConnecting) {
    console.error('Redis Client Error:', err.message);
  }
  // Suppress initial connection errors - Redis is optional
});

redisClient.on('connect', () => {
  console.log('Redis client connecting...');
  isConnecting = true;
});

redisClient.on('ready', () => {
  console.log('Redis client ready');
  isConnecting = false;
  connectionAttempts = 0;
  hasConnectedOnce = true;
});

redisClient.on('reconnecting', () => {
  connectionAttempts++;
  // Only log reconnection attempts occasionally to avoid spam
  if (connectionAttempts % 5 === 0) {
    console.log(`Redis client reconnecting... (attempt ${connectionAttempts})`);
  }
});

/**
 * Connect to Redis
 * @returns {Promise<void>}
 */
export async function connectRedis() {
  try {
    isConnecting = true;
    connectionAttempts = 0;
    await redisClient.connect();
    console.log('Redis connected successfully');
    isConnecting = false;
    hasConnectedOnce = true;
  } catch (error) {
    isConnecting = false;
    // Don't throw - let the caller handle it
    throw error;
  }
}

/**
 * Test Redis connection
 * @returns {Promise<boolean>}
 */
export async function testRedisConnection() {
  try {
    // Check if client is already connected
    if (!redisClient.isOpen) {
      return false;
    }
    await redisClient.ping();
    return true;
  } catch (error) {
    // Silently return false - Redis may not be available
    return false;
  }
}

export default redisClient;
