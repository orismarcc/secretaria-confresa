CREATE TABLE IF NOT EXISTS sefaz_producers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  phone text,
  settlement text,
  location text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sefaz_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sefaz_producer_id uuid NOT NULL REFERENCES sefaz_producers(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  signed_list boolean NOT NULL DEFAULT false,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sefaz_producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sefaz_services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sefaz_producers' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON sefaz_producers
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sefaz_services' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON sefaz_services
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
