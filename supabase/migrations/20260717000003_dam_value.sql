-- ============================================================================
-- Valor (R$) da DAM, preenchido automaticamente ao emitir o Comunicado de DAM
-- (Total = combustível + UPFM). Entra na soma de "arrecadado" apenas quando a
-- DAM é marcada como paga (dam_paid = true).
-- Aditivo e idempotente — não altera fluxo existente.
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS dam_value numeric(12,2);

NOTIFY pgrst, 'reload schema';
