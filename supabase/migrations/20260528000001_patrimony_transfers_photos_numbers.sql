-- ============================================================
-- Patrimony: transfer history, 3 photos, municipal/state numbers
-- ============================================================

-- 1. New columns on patrimony
ALTER TABLE patrimony
  ADD COLUMN IF NOT EXISTS image_url_2           text,
  ADD COLUMN IF NOT EXISTS image_url_3           text,
  ADD COLUMN IF NOT EXISTS patrimony_number_state text;

-- 2. patrimony_transfers — immutable history log
CREATE TABLE IF NOT EXISTS patrimony_transfers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimony_id      uuid        NOT NULL REFERENCES patrimony(id) ON DELETE CASCADE,
  transferred_at    date        NOT NULL,
  location          text,
  responsible_name  text,
  responsible_phone text,
  condition         text        CHECK (condition IN ('otimo', 'bom', 'ruim', 'pessimo')),
  notes             text,
  created_at        timestamptz DEFAULT now(),
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. RLS
ALTER TABLE patrimony_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patrimony_transfers'
      AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON patrimony_transfers
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. FK index (audit pattern)
CREATE INDEX IF NOT EXISTS idx_patrimony_transfers_patrimony_id
  ON patrimony_transfers(patrimony_id);

-- 5. Backfill: create an initial transfer for existing items that already have
--    operational state (location / responsible / condition) set.
INSERT INTO patrimony_transfers
  (patrimony_id, transferred_at, location, responsible_name, responsible_phone, condition, notes)
SELECT
  id,
  COALESCE(acquisition_date, created_at::date, CURRENT_DATE),
  location,
  responsible_name,
  responsible_phone,
  condition,
  'Registro inicial (migração)'
FROM patrimony
WHERE location IS NOT NULL
   OR responsible_name IS NOT NULL
   OR condition IS NOT NULL;

NOTIFY pgrst, 'reload schema';
