-- Add settlement_id FK (from settlements table)
ALTER TABLE sefaz_producers
  ADD COLUMN IF NOT EXISTS settlement_id uuid REFERENCES settlements(id) ON DELETE SET NULL;

-- Add unique constraint on CPF (NULL values are allowed to be multiple, only non-null must be unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sefaz_producers_cpf_key'
  ) THEN
    ALTER TABLE sefaz_producers ADD CONSTRAINT sefaz_producers_cpf_key UNIQUE (cpf);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
