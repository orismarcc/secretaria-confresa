-- ============================================================================
-- Foto (recibo/nota) opcional para cada abastecimento de máquina.
--   Reaproveita o bucket 'service-photos' (prefixo refuels/…). Aditivo.
--   A data/hora do cadastro já é registrada em refueled_at (default now()) e
--   created_at — nenhuma mudança necessária nesses campos.
-- ============================================================================

ALTER TABLE public.machinery_refuels
  ADD COLUMN IF NOT EXISTS receipt_path text;

NOTIFY pgrst, 'reload schema';
