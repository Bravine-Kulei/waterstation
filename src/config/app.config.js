import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration
 * All application-level settings loaded from environment variables
 */
export const appConfig = {
  // Server settings
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API settings
  apiVersion: process.env.API_VERSION || '1.0.0',
  apiPrefix: process.env.API_PREFIX || '/api',
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests from this IP, please try again later.',
  },
  
  // Body parser limits
  bodyParser: {
    jsonLimit: process.env.BODY_PARSER_JSON_LIMIT || '10mb',
    urlencodedLimit: process.env.BODY_PARSER_URLENCODED_LIMIT || '10mb',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  // Security
  security: {
    trustProxy: process.env.TRUST_PROXY === 'true',
  },
};

/**
 * Validate required application configuration
 * @throws {Error} If required configuration is invalid
 */
export function validateAppConfig() {
  // Validate port
  if (appConfig.port < 1 || appConfig.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }
  
  // Validate node environment
  const validEnvironments = ['development', 'production', 'test'];
  if (!validEnvironments.includes(appConfig.nodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${validEnvironments.join(', ')}`);
  }
  
  // Validate rate limit settings
  if (appConfig.rateLimit.windowMs < 1000) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be at least 1000ms');
  }
  
  if (appConfig.rateLimit.max < 1) {
    throw new Error('RATE_LIMIT_MAX must be at least 1');
  }
}

/**
 * Check if running in production
 * @returns {boolean}
 */
export function isProduction() {
  return appConfig.nodeEnv === 'production';
}

/**
 * Check if running in development
 * @returns {boolean}
 */
export function isDevelopment() {
  return appConfig.nodeEnv === 'development';
}
