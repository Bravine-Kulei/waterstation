import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectRedis } from './config/redis.js';
import { appConfig, validateConfig } from './config/index.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import transactionTimeoutService from './services/transactionTimeoutService.js';
import otpExpirationService from './services/otpExpirationService.js';

// Validate configuration on startup
validateConfig();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: appConfig.cors.origin,
    credentials: appConfig.cors.credentials,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: appConfig.rateLimit.windowMs,
  max: appConfig.rateLimit.max,
  message: appConfig.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: appConfig.bodyParser.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: appConfig.bodyParser.urlencodedLimit }));

// Request logging
app.use(requestLogger);

// API routes
app.use(appConfig.apiPrefix, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Water Station API',
    version: appConfig.apiVersion,
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

/**
 * Start server
 */
async function startServer() {
  try {
    // Connect to Redis (non-blocking - server can start without Redis)
    connectRedis().catch((error) => {
      console.warn('Redis connection failed, continuing without Redis:', error.message);
      console.warn('Server will start but Redis-dependent features will be unavailable');
    });

    // Start transaction expiration check (runs every minute)
    transactionTimeoutService.startExpirationCheck(60000);

    // Start OTP expiration check (runs every minute)
    otpExpirationService.startExpirationCheck(60000);

    // Start Express server
    app.listen(appConfig.port, () => {
      console.log({
        type: 'server_start',
        message: `Server running on port ${appConfig.port}`,
        environment: appConfig.nodeEnv,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();

export default app;
