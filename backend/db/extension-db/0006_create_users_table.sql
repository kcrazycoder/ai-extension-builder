-- Create users table for subscription tracking
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Matches WorkOS auth ID
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive', -- active, inactive, past_due
  tier TEXT DEFAULT 'free', -- free, pro
  current_period_end TEXT, -- ISO timestamp
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
