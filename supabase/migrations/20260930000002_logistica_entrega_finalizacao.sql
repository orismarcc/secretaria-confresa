-- ============================================================================
-- Logística (calcário e insumos): novo fluxo do operador
--   Início (foto do odômetro + GPS) → Carregamento (foto + GPS, como já era)
--   → ENTREGA na propriedade (foto + GPS; NÃO finaliza mais)
--   → Finalização (foto do odômetro + GPS).
--
--   * services.delivered_at: quando a entrega foi registrada (o atendimento
--     continua "em execução" até a finalização).
--   * A entrega fica em service_photos com event_type 'delivery'.
--   * A localização copiada para a propriedade do produtor passa a vir da
--     ENTREGA. Atendimentos do fluxo antigo (sem 'delivery') continuam usando
--     o registro de finalização, que era feito na propriedade.
--   Aditivo e idempotente: nenhum dado existente é alterado.
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Reaberto (volta para pendente/próximo): limpa a marca de entrega, como já
-- acontece com a de carregamento.
CREATE OR REPLACE FUNCTION public.trg_services_loaded_at_reset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending', 'proximo') THEN
    NEW.loaded_at := NULL;
    NEW.delivered_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_loaded_at_reset ON public.services;
CREATE TRIGGER services_loaded_at_reset
  BEFORE INSERT OR UPDATE OF status, loaded_at, delivered_at ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_loaded_at_reset();

-- Coordenada da propriedade a partir do atendimento.
CREATE OR REPLACE FUNCTION public.coordenada_propriedade_do_atendimento(_service_id uuid)
RETURNS TABLE (lat numeric, lng numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat text;
  _lat numeric;
  _lng numeric;
BEGIN
  SELECT dt.category, s.latitude, s.longitude
    INTO _cat, _lat, _lng
    FROM public.services s
    LEFT JOIN public.demand_types dt ON dt.id = s.demand_type_id
   WHERE s.id = _service_id;

  IF _cat IN ('calcario', 'logistica_insumos') THEN
    IF EXISTS (SELECT 1 FROM public.service_photos
                WHERE service_id = _service_id AND event_type = 'delivery') THEN
      -- Fluxo novo: a propriedade é o local da ENTREGA (a finalização pode
      -- ser feita em outro lugar, ex.: na garagem).
      SELECT sp.latitude, sp.longitude INTO _lat, _lng
        FROM public.service_photos sp
       WHERE sp.service_id = _service_id AND sp.event_type = 'delivery' AND sp.latitude IS NOT NULL
       ORDER BY sp.captured_at DESC NULLS LAST
       LIMIT 1;
    ELSE
      -- Fluxo antigo: a finalização era feita na propriedade.
      SELECT sp.latitude, sp.longitude INTO _lat, _lng
        FROM public.service_photos sp
       WHERE sp.service_id = _service_id AND sp.event_type = 'finish' AND sp.latitude IS NOT NULL
       ORDER BY sp.captured_at DESC NULLS LAST
       LIMIT 1;
    END IF;
    IF NOT FOUND THEN _lat := NULL; _lng := NULL; END IF;
  ELSIF _lat IS NULL OR _lng IS NULL THEN
    -- Sem GPS no atendimento: usa o registro de início, se houver.
    SELECT sp.latitude, sp.longitude INTO _lat, _lng
      FROM public.service_photos sp
     WHERE sp.service_id = _service_id AND sp.event_type = 'start' AND sp.latitude IS NOT NULL
     ORDER BY sp.captured_at DESC NULLS LAST
     LIMIT 1;
    IF NOT FOUND THEN _lat := NULL; _lng := NULL; END IF;
  END IF;

  -- Região de Confresa/MT com folga. Fora disso é GPS inválido.
  IF _lat IS NULL OR _lng IS NULL
     OR _lat NOT BETWEEN -13 AND -8 OR _lng NOT BETWEEN -54 AND -49 THEN
    RETURN;
  END IF;

  lat := _lat; lng := _lng;
  RETURN NEXT;
END $$;

REVOKE EXECUTE ON FUNCTION public.coordenada_propriedade_do_atendimento(uuid) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
