import dotenv from 'dotenv';

dotenv.config();

/**
 * Database configuration
 * All database-related settings loaded from environment variables
 */
export const databaseConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
  },
};

/**
 * Validate required database configuration
 * @throws {Error} If required configuration is missing
 */
export function validateDatabaseConfig() {
  const required = ['host', 'database', 'user', 'password'];
  const missing = required.filter((key) => !databaseConfig[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  }
}
