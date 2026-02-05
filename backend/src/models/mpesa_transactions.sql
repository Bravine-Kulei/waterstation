-- M-Pesa Transactions table
-- This table stores all M-Pesa payment transactions via Daraja API

CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id SERIAL PRIMARY KEY,
    transaction_reference VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    liters DECIMAL(10, 2) NOT NULL CHECK (liters > 0),
    currency VARCHAR(3) DEFAULT 'KES',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Daraja/M-Pesa specific fields
    checkout_request_id VARCHAR(255),
    merchant_request_id VARCHAR(255),
    mpesa_receipt_number VARCHAR(255),
    transaction_date TIMESTAMP WITH TIME ZONE,
    result_code INTEGER,
    result_desc TEXT,
    
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'timeout'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mpesa_txn_reference ON mpesa_transactions(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_mpesa_phone ON mpesa_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_receipt ON mpesa_transactions(mpesa_receipt_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_created_at ON mpesa_transactions(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_mpesa_transactions_updated_at 
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_transactions_updated_at_column();
