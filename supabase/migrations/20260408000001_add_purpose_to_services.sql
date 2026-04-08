-- Add purpose column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS purpose text;

-- Migrate existing data: copy notes → purpose, clear notes
UPDATE services
SET purpose = notes,
    notes = NULL
WHERE notes IS NOT NULL AND notes != '';
