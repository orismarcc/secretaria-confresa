ALTER TABLE services
  ADD COLUMN IF NOT EXISTS limestone_quantity numeric(10,2);

NOTIFY pgrst, 'reload schema';
