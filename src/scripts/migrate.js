import { runMigrations, checkMigrations } from '../utils/migrations.js';
import { logEvent } from '../middleware/logger.js';

/**
 * Database migration script
 * Run this to set up the database schema
 */
async function migrate() {
  try {
    console.log('Checking if migrations are needed...');
    const alreadyMigrated = await checkMigrations();

    if (alreadyMigrated) {
      console.log('Transactions table already exists. Skipping migration.');
      return;
    }

    console.log('Running migrations...');
    await runMigrations();
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
