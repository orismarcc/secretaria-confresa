-- ============================================================================
-- Logística (calcário e insumos): etapa intermediária de CARREGAMENTO.
-- Fluxo do operador nesses serviços: Iniciar (GPS de partida) → "Entrega"
-- (foto do caminhão sendo carregado + GPS do local de carregamento) →
-- Finalizar (foto + GPS da entrega na propriedade do produtor).
--
-- loaded_at marca que o carregamento foi registrado. A foto e as coordenadas
-- de cada etapa ficam em service_photos (event_type 'start' | 'loading' |
-- 'finish'), como já acontece hoje. Aditivo e idempotente.
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS loaded_at timestamptz;

-- Se o atendimento voltar para pendente/próximo (reaberto), a marca de
-- carregamento é limpa — para o operador não pular a etapa ao reiniciar.
-- Mantida em 'in_progress', 'completed' e 'cancelled' (histórico).
CREATE OR REPLACE FUNCTION public.trg_services_loaded_at_reset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending', 'proximo') THEN
    NEW.loaded_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_loaded_at_reset ON public.services;
CREATE TRIGGER services_loaded_at_reset
  BEFORE INSERT OR UPDATE OF status, loaded_at ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_loaded_at_reset();

NOTIFY pgrst, 'reload schema';
