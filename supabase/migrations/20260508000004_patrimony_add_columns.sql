ALTER TABLE patrimony
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS responsible_phone text;

NOTIFY pgrst, 'reload schema';
