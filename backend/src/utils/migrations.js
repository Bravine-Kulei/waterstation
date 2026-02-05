import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run database migrations
 * @returns {Promise<void>}
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Read and execute transactions.sql
    const transactionsSqlPath = path.join(__dirname, '../models/transactions.sql');
    const transactionsSql = fs.readFileSync(transactionsSqlPath, 'utf8');
    
    // Execute transactions SQL (handle errors gracefully)
    try {
      await client.query(transactionsSql);
      console.log('✓ Transactions table created');
    } catch (error) {
      // Check if it's an "already exists" error
      if (error.code === '42P07' || error.message.includes('already exists')) {
        console.log('✓ Transactions table already exists, skipping...');
      } else {
        throw error;
      }
    }

    // Read and execute otps.sql
    const otpsSqlPath = path.join(__dirname, '../models/otps.sql');
    const otpsSql = fs.readFileSync(otpsSqlPath, 'utf8');
    
    // Execute OTPs SQL (handle errors gracefully)
    try {
      await client.query(otpsSql);
      console.log('✓ OTPs table created');
    } catch (error) {
      // Check if it's an "already exists" error
      if (error.code === '42P07' || error.message.includes('already exists')) {
        console.log('✓ OTPs table already exists, applying migration...');
        // Apply migration for existing table
        const migrationSqlPath = path.join(__dirname, '../models/otps_migration.sql');
        const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');
        try {
          await client.query(migrationSql);
          console.log('✓ OTPs table migration applied');
        } catch (migrationError) {
          // Ignore migration errors if columns already exist
          if (migrationError.code !== '42701' && migrationError.code !== '42P16') {
            console.log('Note: Some migration steps may have already been applied');
          }
        }
      } else {
        throw error;
      }
    }

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure your database user has CREATE privileges');
    console.error('2. Run as database superuser or grant permissions:');
    console.error('   GRANT ALL ON SCHEMA public TO your_db_user;');
    console.error('   GRANT ALL PRIVILEGES ON DATABASE your_db_name TO your_db_user;');
    console.error('3. Ensure the database exists: CREATE DATABASE your_db_name;');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if migrations have been run
 * @returns {Promise<boolean>}
 */
export async function checkMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    console.error('Failed to check migrations:', error);
    return false;
  } finally {
    client.release();
  }
}
