-- ============================================================================
-- Restituição de DAM: TODO atendimento cancelado com DAM paga fica com a
-- restituição PENDENTE (com ou sem ofício gerado pelo sistema), para que o
-- valor seja descontado do total de DAMs quando a restituição for confirmada.
--  * Vale para cancelamentos futuros e para DAM marcada como paga depois
--    do cancelamento (gatilho).
--  * Os cancelados com DAM paga que hoje estão sem restituição passam a
--    "pendente" (valor = valor da DAM). Nada é emitido.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_services_restituicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  -- Reaberto: a restituição pendente deixa de existir (regra anterior)
  IF NEW.status <> 'cancelled' AND NEW.restituicao_status = 'pendente' THEN
    NEW.restituicao_status := NULL;
    NEW.restituicao_valor := NULL;
    NEW.restituicao_motivo := NULL;
    NEW.restituicao_oficio := NULL;
    NEW.restituicao_solicitada_em := NULL;
  END IF;

  -- Cancelado com DAM paga e sem restituição: fica pendente
  IF NEW.status = 'cancelled' AND COALESCE(NEW.dam_paid, false) AND NEW.restituicao_status IS NULL THEN
    NEW.restituicao_status := 'pendente';
    NEW.restituicao_valor := COALESCE(NEW.restituicao_valor, NEW.dam_value);
  END IF;

  IF NEW.restituicao_status IS DISTINCT FROM 'confirmada' THEN
    NEW.restituicao_confirmada_em := NULL;
    NEW.restituicao_confirmada_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_restituicao_trigger ON public.services;
CREATE TRIGGER services_restituicao_trigger
  BEFORE INSERT OR UPDATE OF status, restituicao_status, dam_paid ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_restituicao();

-- Cancelados que já têm DAM paga e estão sem restituição (documentos feitos à mão)
UPDATE public.services
   SET restituicao_status = 'pendente',
       restituicao_valor = COALESCE(restituicao_valor, dam_value)
 WHERE status = 'cancelled'
   AND dam_paid = true
   AND restituicao_status IS NULL;

NOTIFY pgrst, 'reload schema';
