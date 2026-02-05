-- OTPs table for one-time passwords
-- Stores hashed OTPs linked to transactions

CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    transaction_reference VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    liters DECIMAL(10, 2) NOT NULL CHECK (liters > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    station_id VARCHAR(255), -- Station that verified/claimed the OTP (for station locking)
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    used_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE, -- When OTP was verified by station
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint (optional, depends on your setup)
    -- CONSTRAINT fk_transaction FOREIGN KEY (transaction_reference) REFERENCES transactions(transaction_reference),
    
    -- Indexes for performance
    CONSTRAINT valid_status CHECK (status IN ('active', 'in_progress', 'used', 'expired', 'blocked'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_otps_transaction_reference ON otps(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_otps_status ON otps(status);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at);

-- Composite index for active OTP lookups
CREATE INDEX IF NOT EXISTS idx_otps_active_lookup ON otps(transaction_reference, status, expires_at) 
WHERE status IN ('active', 'in_progress');

-- Index for station lookups
CREATE INDEX IF NOT EXISTS idx_otps_station_id ON otps(station_id) WHERE station_id IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_otps_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_otps_updated_at 
    BEFORE UPDATE ON otps
    FOR EACH ROW
    EXECUTE FUNCTION update_otps_updated_at_column();
