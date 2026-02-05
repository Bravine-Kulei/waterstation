-- Transactions table for Paystack payments
-- This table stores all payment transactions

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_reference VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'NGN',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Paystack specific fields
    paystack_reference VARCHAR(255),
    paystack_access_code VARCHAR(255),
    paystack_authorization_url TEXT,
    paystack_status VARCHAR(50),
    paystack_gateway_response TEXT,
    paystack_channel VARCHAR(50),
    paystack_customer_id VARCHAR(255),
    paystack_authorization_code VARCHAR(255),
    paystack_bin VARCHAR(50),
    paystack_last4 VARCHAR(10),
    paystack_exp_month VARCHAR(10),
    paystack_exp_year VARCHAR(10),
    paystack_card_type VARCHAR(50),
    paystack_bank VARCHAR(100),
    paystack_country_code VARCHAR(10),
    paystack_brand VARCHAR(50),
    paystack_reusable BOOLEAN DEFAULT FALSE,
    paystack_signature VARCHAR(255),
    paystack_paid_at TIMESTAMP WITH TIME ZONE,
    
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes for performance
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'expired', 'abandoned', 'reversed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_paystack_reference ON transactions(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_email ON transactions(email);
CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
