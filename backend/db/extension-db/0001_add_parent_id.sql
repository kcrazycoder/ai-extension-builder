ALTER TABLE extensions ADD COLUMN parent_id VARCHAR(255);
CREATE INDEX idx_extensions_parent_id ON extensions(parent_id);
