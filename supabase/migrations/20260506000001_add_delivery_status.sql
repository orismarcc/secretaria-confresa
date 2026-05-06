-- Adiciona controle de status nas entregas
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
