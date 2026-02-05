import pg from 'pg';
import { databaseConfig } from './database.config.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool
 * Configured for production use with connection limits
 * Uses centralized configuration from database.config.js
 */
const pool = new Pool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.user,
  password: databaseConfig.password,
  max: databaseConfig.pool.max,
  idleTimeoutMillis: databaseConfig.pool.idleTimeoutMillis,
  connectionTimeoutMillis: databaseConfig.pool.connectionTimeoutMillis,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
export async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export default pool;
