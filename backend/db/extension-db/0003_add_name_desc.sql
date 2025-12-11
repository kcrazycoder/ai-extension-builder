-- Add name and description columns to extensions table
ALTER TABLE extensions ADD COLUMN name TEXT;
ALTER TABLE extensions ADD COLUMN description TEXT;
