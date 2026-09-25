-- ============================================================================
-- Ajuste da cópia da localização (20260925000003): o PRIMEIRO GPS válido
-- preenche o cadastro e NÃO é mais sobrescrito automaticamente.
--
-- Motivo (dados reais): o GPS é captado quando o operador toca "Iniciar". Houve
-- atendimentos iniciados fora da propriedade (ex.: no fim do dia, na cidade),
-- e a regra "o mais recente vence" trocou uma localização correta por uma
-- errada. Agora:
--   * cadastro SEM localização (vazio, 0,0 ou fora da região) → recebe o GPS;
--   * cadastro COM localização → mantido (inclusive correções manuais).
-- Correção dos dados: produtores preenchidos pela migração anterior cuja
-- localização ainda é a do atendimento MAIS RECENTE passam a ter a do PRIMEIRO
-- atendimento com GPS. Quem já foi corrigido à mão não é tocado.
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.coordenada_valida(_lat numeric, _lng numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _lat IS NOT NULL AND _lng IS NOT NULL
     AND _lat BETWEEN -13 AND -8 AND _lng BETWEEN -54 AND -49
$$;

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

  -- Só preenche quando o cadastro ainda não tem localização válida.
  IF _property IS NOT NULL THEN
    INSERT INTO public.backup_localizacao_produtor (alvo, alvo_id, old_latitude, old_longitude)
      SELECT 'producer_properties', pp.id, pp.latitude, pp.longitude
        FROM public.producer_properties pp
       WHERE pp.id = _property AND NOT public.coordenada_valida(pp.latitude, pp.longitude)
      ON CONFLICT DO NOTHING;
    UPDATE public.producer_properties
       SET latitude = _c.lat, longitude = _c.lng
     WHERE id = _property AND NOT public.coordenada_valida(latitude, longitude);
  ELSE
    INSERT INTO public.backup_localizacao_produtor (alvo, alvo_id, old_latitude, old_longitude)
      SELECT 'producers', p.id, p.latitude, p.longitude
        FROM public.producers p
       WHERE p.id = _producer AND NOT public.coordenada_valida(p.latitude, p.longitude)
      ON CONFLICT DO NOTHING;
    UPDATE public.producers
       SET latitude = _c.lat, longitude = _c.lng
     WHERE id = _producer AND NOT public.coordenada_valida(latitude, longitude);
  END IF;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.copiar_localizacao_para_propriedade(uuid) FROM PUBLIC, anon, authenticated;

-- Correção: "mais recente" → "primeiro", só onde o valor ainda é o que a
-- migração anterior gravou (o do atendimento mais recente).
DO $$
DECLARE
  r record;
  _pri record;
  _ult record;
  _n int := 0;
  _k int;
BEGIN
  FOR r IN SELECT alvo, alvo_id FROM public.backup_localizacao_produtor LOOP
    SELECT c.lat, c.lng INTO _pri
      FROM public.services s CROSS JOIN LATERAL public.coordenada_propriedade_do_atendimento(s.id) c
     WHERE s.status = 'completed'
       AND CASE WHEN r.alvo = 'producers' THEN s.producer_id = r.alvo_id AND s.property_id IS NULL
                ELSE s.property_id = r.alvo_id END
     ORDER BY s.completed_at ASC NULLS LAST, s.updated_at ASC NULLS LAST
     LIMIT 1;
    SELECT c.lat, c.lng INTO _ult
      FROM public.services s CROSS JOIN LATERAL public.coordenada_propriedade_do_atendimento(s.id) c
     WHERE s.status = 'completed'
       AND CASE WHEN r.alvo = 'producers' THEN s.producer_id = r.alvo_id AND s.property_id IS NULL
                ELSE s.property_id = r.alvo_id END
     ORDER BY s.completed_at DESC NULLS LAST, s.updated_at DESC NULLS LAST
     LIMIT 1;
    IF _pri.lat IS NULL OR _ult.lat IS NULL
       OR (_pri.lat = _ult.lat AND _pri.lng = _ult.lng) THEN
      CONTINUE;
    END IF;

    IF r.alvo = 'producers' THEN
      UPDATE public.producers SET latitude = _pri.lat, longitude = _pri.lng
       WHERE id = r.alvo_id AND latitude = _ult.lat AND longitude = _ult.lng;
    ELSE
      UPDATE public.producer_properties SET latitude = _pri.lat, longitude = _pri.lng
       WHERE id = r.alvo_id AND latitude = _ult.lat AND longitude = _ult.lng;
    END IF;
    GET DIAGNOSTICS _k = ROW_COUNT;
    _n := _n + _k;
  END LOOP;
  RAISE NOTICE 'Localização: % cadastro(s) corrigido(s) para o primeiro GPS do operador.', _n;
END $$;

NOTIFY pgrst, 'reload schema';
