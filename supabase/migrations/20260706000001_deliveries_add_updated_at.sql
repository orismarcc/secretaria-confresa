-- ============================================================
-- Corrige erro "record 'new' has no field updated_at" ao editar entrega.
-- A tabela deliveries tem o trigger update_deliveries_updated_at (que seta
-- NEW.updated_at), mas a coluna updated_at nunca foi criada.
-- ============================================================

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill: linhas existentes recebem a data de criação
UPDATE public.deliveries
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

-- Novos registros: default now()
ALTER TABLE public.deliveries
  ALTER COLUMN updated_at SET DEFAULT now();

NOTIFY pgrst, 'reload schema';
