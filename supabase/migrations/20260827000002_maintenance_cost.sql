-- ============================================================
-- Manutenções: valor (custo) do reparo/manutenção.
--   Campo opcional, usado nas métricas de gasto mensal e acumulado.
--   A data/hora de término já é suportada por ended_at (timestamptz),
--   permitindo manutenções que duram mais de um dia.
-- ============================================================

ALTER TABLE public.machinery_maintenance
  ADD COLUMN IF NOT EXISTS cost numeric(12,2);

NOTIFY pgrst, 'reload schema';
