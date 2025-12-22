-- Migration number: 0007 	 2025-12-19T17:45:00.000Z
-- Add role column to users table and set initial admin

ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Set super admin
UPDATE users SET role = 'admin' WHERE email = 'kcrazycoder@gmail.com';
