-- ============================================================================
-- Localização da propriedade vem do GPS do operador.
--
-- Ao FINALIZAR um atendimento, a coordenada marcada pelo operador é copiada para
-- o cadastro da propriedade atendida:
--   * services.property_id preenchido → producer_properties (propriedade adicional)
--   * services.property_id vazio      → producers (propriedade principal)
--
-- Qual coordenada é "da propriedade":
--   * Logística (calcário / insumos): GPS do FINALIZAR (entrega na propriedade)
--     — o GPS do Iniciar é o ponto de partida e o do carregamento é o depósito.
--   * Demais serviços: GPS do INICIAR (services.latitude/longitude, gravado quando
--     o operador começa o serviço na propriedade).
--
-- Segurança e não-regressão:
--   * Trigger AFTER UPDATE só na transição para 'completed'. Falha na cópia NUNCA
--     impede a finalização (erro vira WARNING).
--   * SECURITY DEFINER apenas para esta cópia: o operador continua SEM permissão
--     de editar produtores/propriedades pela API.
--   * Coordenada fora da região de Confresa (ou 0,0 / nula) é ignorada.
--   * Backfill dos atendimentos já finalizados (o mais recente de cada propriedade
--     vence), com os valores anteriores guardados em backup_localizacao_produtor
--     (RLS: só admin). Idempotente.
-- ============================================================================

-- 1. Coordenada "da propriedade" de um atendimento (NULL se não houver válida).
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
    SELECT sp.latitude, sp.longitude INTO _lat, _lng
      FROM public.service_photos sp
     WHERE sp.service_id = _service_id AND sp.event_type = 'finish' AND sp.latitude IS NOT NULL
     ORDER BY sp.captured_at DESC NULLS LAST
     LIMIT 1;
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

  -- Região de Confresa/MT com folga (sede ≈ -10.64, -51.57). Fora disso é GPS
  -- inválido (0,0, emulador etc.) e não deve sobrescrever o cadastro.
  IF _lat IS NULL OR _lng IS NULL
     OR _lat NOT BETWEEN -13 AND -8 OR _lng NOT BETWEEN -54 AND -49 THEN
    RETURN;
  END IF;

  lat := _lat; lng := _lng;
  RETURN NEXT;
END $$;

REVOKE EXECUTE ON FUNCTION public.coordenada_propriedade_do_atendimento(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Backup dos valores anteriores (só a 1ª vez de cada cadastro), para desfazer.
CREATE TABLE IF NOT EXISTS public.backup_localizacao_produtor (
  alvo        text NOT NULL CHECK (alvo IN ('producers', 'producer_properties')),
  alvo_id     uuid NOT NULL,
  old_latitude  numeric,
  old_longitude numeric,
  backed_up_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alvo, alvo_id)
);
ALTER TABLE public.backup_localizacao_produtor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_localizacao_produtor FROM anon;
DROP POLICY IF EXISTS "backup_localizacao_produtor_admin" ON public.backup_localizacao_produtor;
CREATE POLICY "backup_localizacao_produtor_admin" ON public.backup_localizacao_produtor
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Copia a coordenada do atendimento para a propriedade dele.
CREATE OR REPLACE FUNCTION public.copiar_localizacao_para_propriedade(_service_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _producer uuid;
  _property uuid;
  _c record;
  _n int;
BEGIN
  SELECT producer_id, property_id INTO _producer, _property FROM public.services WHERE id = _service_id;
  IF _producer IS NULL THEN RETURN false; END IF;

  SELECT * INTO _c FROM public.coordenada_propriedade_do_atendimento(_service_id);
  IF _c.lat IS NULL THEN RETURN false; END IF;

  IF _property IS NOT NULL THEN
    INSERT INTO public.backup_localizacao_produtor (alvo, alvo_id, old_latitude, old_longitude)
      SELECT 'producer_properties', pp.id, pp.latitude, pp.longitude
        FROM public.producer_properties pp WHERE pp.id = _property
      ON CONFLICT DO NOTHING;
    UPDATE public.producer_properties
       SET latitude = _c.lat, longitude = _c.lng
     WHERE id = _property
       AND (latitude IS DISTINCT FROM _c.lat OR longitude IS DISTINCT FROM _c.lng);
  ELSE
    INSERT INTO public.backup_localizacao_produtor (alvo, alvo_id, old_latitude, old_longitude)
      SELECT 'producers', p.id, p.latitude, p.longitude
        FROM public.producers p WHERE p.id = _producer
      ON CONFLICT DO NOTHING;
    UPDATE public.producers
       SET latitude = _c.lat, longitude = _c.lng
     WHERE id = _producer
       AND (latitude IS DISTINCT FROM _c.lat OR longitude IS DISTINCT FROM _c.lng);
  END IF;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.copiar_localizacao_para_propriedade(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Trigger: na finalização. Nunca bloqueia a finalização.
CREATE OR REPLACE FUNCTION public.trg_services_localizacao_propriedade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.copiar_localizacao_para_propriedade(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Localização do atendimento % não copiada para o produtor: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS services_localizacao_propriedade ON public.services;
CREATE TRIGGER services_localizacao_propriedade
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.trg_services_localizacao_propriedade();

-- 5. Backfill: para cada propriedade, o atendimento finalizado MAIS RECENTE que
--    tenha coordenada válida.
DO $$
DECLARE
  r record;
  _prod int := 0;
  _props int := 0;
  _cands int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (s.producer_id, s.property_id) s.id, s.property_id
      FROM public.services s
      CROSS JOIN LATERAL public.coordenada_propriedade_do_atendimento(s.id) c
     WHERE s.status = 'completed' AND s.producer_id IS NOT NULL
     ORDER BY s.producer_id, s.property_id, s.completed_at DESC NULLS LAST, s.updated_at DESC NULLS LAST
  LOOP
    _cands := _cands + 1;
    IF public.copiar_localizacao_para_propriedade(r.id) THEN
      IF r.property_id IS NULL THEN _prod := _prod + 1; ELSE _props := _props + 1; END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'Localização pelo atendimento: % propriedade(s) com GPS válido; % produtor(es) e % propriedade(s) adicional(is) atualizados.', _cands, _prod, _props;
END $$;

NOTIFY pgrst, 'reload schema';
