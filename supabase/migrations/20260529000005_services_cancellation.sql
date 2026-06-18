-- ============================================================
-- Cancelamento de atendimentos
--   - novo status 'cancelled'
--   - motivo do cancelamento (cancellation_reason)
--   - trigger garante: completed_at só em 'completed';
--     cancellation_reason só em 'cancelled'
-- ============================================================

-- 1. Permitir 'cancelled' no CHECK de status
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_status_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'proximo', 'cancelled'));

-- 2. Coluna de motivo
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 3. Estende o trigger de normalização (substitui o de 20260529000004)
CREATE OR REPLACE FUNCTION public.trg_services_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  -- completed_at só existe quando finalizado
  IF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  -- cancellation_reason só existe quando cancelado
  IF NEW.status <> 'cancelled' THEN
    NEW.cancellation_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_completed_at_trigger ON public.services;
CREATE TRIGGER services_completed_at_trigger
  BEFORE INSERT OR UPDATE OF status, completed_at, cancellation_reason ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_completed_at();

NOTIFY pgrst, 'reload schema';
