-- 1. Responsible Technicians table
CREATE TABLE IF NOT EXISTS responsible_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  cargo text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE responsible_technicians ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'responsible_technicians'
      AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON responsible_technicians
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Link responsible technician to services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS responsible_technician_id uuid REFERENCES responsible_technicians(id) ON DELETE SET NULL;

-- 3. CAF field on producers
ALTER TABLE producers
  ADD COLUMN IF NOT EXISTS caf text;

NOTIFY pgrst, 'reload schema';
