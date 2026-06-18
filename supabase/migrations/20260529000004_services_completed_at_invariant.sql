-- ============================================================
-- Invariante: services.completed_at só existe quando status = 'completed'
-- Corrige atendimentos reabertos que mantinham a data de finalização
-- e garante a consistência no nível do banco.
-- ============================================================

-- 1. Limpeza dos dados já inconsistentes
UPDATE public.services
SET completed_at = NULL
WHERE status <> 'completed'
  AND completed_at IS NOT NULL;

-- 2. Trigger que normaliza completed_at em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_services_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_completed_at_trigger ON public.services;
CREATE TRIGGER services_completed_at_trigger
  BEFORE INSERT OR UPDATE OF status, completed_at ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_completed_at();

NOTIFY pgrst, 'reload schema';
