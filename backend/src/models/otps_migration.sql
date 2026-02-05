-- Migration: Add station_id, verified_at, and IN_PROGRESS status to otps table
-- Run this if you have an existing otps table

-- Add station_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'otps' AND column_name = 'station_id'
    ) THEN
        ALTER TABLE otps ADD COLUMN station_id VARCHAR(255);
    END IF;
END $$;

-- Add verified_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'otps' AND column_name = 'verified_at'
    ) THEN
        ALTER TABLE otps ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update status constraint to include 'in_progress'
-- First, drop the existing constraint
ALTER TABLE otps DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with 'in_progress' status
ALTER TABLE otps ADD CONSTRAINT valid_status 
    CHECK (status IN ('active', 'in_progress', 'used', 'expired', 'blocked'));

-- Create index for station_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_otps_station_id ON otps(station_id) WHERE station_id IS NOT NULL;

-- Update the active lookup index to include 'in_progress'
DROP INDEX IF EXISTS idx_otps_active_lookup;
CREATE INDEX IF NOT EXISTS idx_otps_active_lookup 
    ON otps(transaction_reference, status, expires_at) 
    WHERE status IN ('active', 'in_progress');
