import { testDatabaseConnection } from '../config/database.js';
import { testRedisConnection } from '../config/redis.js';

/**
 * Health check controller
 * Returns system health status
 */
export async function getHealth(req, res, next) {
  try {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {},
    };

    // Check database
    const dbHealthy = await testDatabaseConnection();
    checks.services.database = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
    };

    // Check Redis
    const redisHealthy = await testRedisConnection();
    checks.services.redis = {
      status: redisHealthy ? 'healthy' : 'unhealthy',
    };

    // Determine overall status
    const allHealthy = dbHealthy && redisHealthy;
    checks.status = allHealthy ? 'healthy' : 'degraded';

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json({
      success: true,
      data: checks,
    });
  } catch (error) {
    next(error);
  }
}
