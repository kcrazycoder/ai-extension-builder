CREATE TABLE extensions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, processing, completed, failed
  zip_key VARCHAR(255),
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_extensions_user_id ON extensions(user_id);
