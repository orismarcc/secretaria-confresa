-- Add GPS coordinates to patrimony table
ALTER TABLE patrimony
  ADD COLUMN IF NOT EXISTS latitude  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);

NOTIFY pgrst, 'reload schema';
