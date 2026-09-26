-- ============================================================================
-- Mapa de calor da demanda + painel público de transparência.
-- Só ACRESCENTA:
--   * settlements.latitude/longitude (opcionais) — ponto central do
--     assentamento, marcado uma vez pela equipe;
--   * demanda_por_assentamento(): números por assentamento (equipe; respeita
--     as permissões de quem consulta);
--   * demanda_pontos(): pontos das propriedades localizadas (equipe);
--   * transparencia_resumo(): SÓ NÚMEROS AGREGADOS para o painel público (sem
--     nome, CPF, telefone ou localização de ninguém). Assentamento com menos de
--     3 produtores atendidos no ano aparece somado em "Outros" (evita
--     identificar pessoas).
-- ============================================================================

ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settlements_coords_ok') THEN
    ALTER TABLE public.settlements ADD CONSTRAINT settlements_coords_ok CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude IS NOT NULL AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
  END IF;
END $$;

-- ─── Por assentamento (equipe) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.demanda_por_assentamento(
  _inicio date, _fim date, _demand_type_id uuid DEFAULT NULL)
RETURNS TABLE (
  settlement_id uuid, nome text, latitude numeric, longitude numeric, posicao text,
  abertos int, horas_pedidas numeric, espera_media_dias numeric, espera_max_dias int,
  concluidos int, horas_trabalhadas numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH sv AS (
    SELECT s.* FROM public.services s
    WHERE s.settlement_id IS NOT NULL
      AND (_demand_type_id IS NULL OR s.demand_type_id = _demand_type_id)
  ), ab AS (
    SELECT settlement_id, count(*)::int AS abertos,
      coalesce(sum(worked_hours), 0) AS horas_pedidas,
      avg(current_date - (created_at AT TIME ZONE 'America/Cuiaba')::date) AS espera_media,
      max(current_date - (created_at AT TIME ZONE 'America/Cuiaba')::date)::int AS espera_max
    FROM sv WHERE status NOT IN ('completed', 'cancelled')
    GROUP BY settlement_id
  ), co AS (
    SELECT settlement_id, count(*)::int AS concluidos, coalesce(sum(worked_hours), 0) AS horas
    FROM sv WHERE status = 'completed'
      AND (completed_at AT TIME ZONE 'America/Cuiaba')::date BETWEEN _inicio AND _fim
    GROUP BY settlement_id
  ), centro AS (   -- sem ponto marcado: média dos produtores localizados
    SELECT settlement_id, avg(latitude) AS lat, avg(longitude) AS lng
    FROM public.producers
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND settlement_id IS NOT NULL
      AND latitude BETWEEN -13 AND -8 AND longitude BETWEEN -54 AND -49
    GROUP BY settlement_id
  )
  SELECT st.id, st.name,
    coalesce(st.latitude, c.lat), coalesce(st.longitude, c.lng),
    CASE WHEN st.latitude IS NOT NULL THEN 'marcada' WHEN c.lat IS NOT NULL THEN 'estimada' ELSE 'sem' END,
    coalesce(ab.abertos, 0), round(coalesce(ab.horas_pedidas, 0), 1),
    round(coalesce(ab.espera_media, 0), 0), coalesce(ab.espera_max, 0),
    coalesce(co.concluidos, 0), round(coalesce(co.horas, 0), 1)
  FROM public.settlements st
  LEFT JOIN ab ON ab.settlement_id = st.id
  LEFT JOIN co ON co.settlement_id = st.id
  LEFT JOIN centro c ON c.settlement_id = st.id
  ORDER BY coalesce(ab.abertos, 0) DESC, st.name
$$;

REVOKE EXECUTE ON FUNCTION public.demanda_por_assentamento(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demanda_por_assentamento(date, date, uuid) TO authenticated;

-- ─── Pontos das propriedades localizadas (equipe) ───────────────────────────
CREATE OR REPLACE FUNCTION public.demanda_pontos(_demand_type_id uuid DEFAULT NULL)
RETURNS TABLE (latitude numeric, longitude numeric, abertos int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT coalesce(pp.latitude, p.latitude), coalesce(pp.longitude, p.longitude), count(*)::int
  FROM public.services s
  JOIN public.producers p ON p.id = s.producer_id
  LEFT JOIN public.producer_properties pp ON pp.id = s.property_id
  WHERE s.status NOT IN ('completed', 'cancelled')
    AND (_demand_type_id IS NULL OR s.demand_type_id = _demand_type_id)
    AND coalesce(pp.latitude, p.latitude) IS NOT NULL
    AND coalesce(pp.longitude, p.longitude) IS NOT NULL
  GROUP BY 1, 2
$$;

REVOKE EXECUTE ON FUNCTION public.demanda_pontos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demanda_pontos(uuid) TO authenticated;

-- ─── Transparência (público, só agregados) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.transparencia_resumo(_ano int)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH c AS (
    SELECT s.*, (s.completed_at AT TIME ZONE 'America/Cuiaba') AS quando
    FROM public.services s
    WHERE s.status = 'completed'
      AND extract(year FROM (s.completed_at AT TIME ZONE 'America/Cuiaba')) = _ano
  ), por_assent AS (
    SELECT coalesce(st.name, 'Não informado') AS nome,
      count(*)::int AS atendimentos, count(DISTINCT c.producer_id)::int AS produtores,
      round(coalesce(sum(c.worked_hours), 0), 1) AS horas
    FROM c LEFT JOIN public.settlements st ON st.id = c.settlement_id
    GROUP BY 1
  ), assent_final AS (   -- supressão de células pequenas (< 3 produtores)
    SELECT CASE WHEN produtores >= 3 THEN nome ELSE 'Outros (menos de 3 produtores cada)' END AS nome,
      sum(atendimentos)::int AS atendimentos, sum(produtores)::int AS produtores, sum(horas) AS horas
    FROM por_assent GROUP BY 1
  )
  SELECT jsonb_build_object(
    'ano', _ano,
    'gerado_em', now(),
    'totais', (SELECT jsonb_build_object(
        'atendimentos', count(*),
        'produtores_atendidos', count(DISTINCT producer_id),
        'horas_maquina', round(coalesce(sum(worked_hours), 0), 1),
        'hectares', round(coalesce(sum(worked_area), 0), 1),
        'assentamentos_atendidos', count(DISTINCT settlement_id)) FROM c),
    'em_aberto_hoje', (SELECT count(*) FROM public.services WHERE status NOT IN ('completed', 'cancelled')),
    'por_mes', (SELECT coalesce(jsonb_agg(jsonb_build_object('mes', m, 'atendimentos', n, 'horas', h) ORDER BY m), '[]'::jsonb)
        FROM (SELECT extract(month FROM quando)::int AS m, count(*) AS n, round(coalesce(sum(worked_hours), 0), 1) AS h
              FROM c GROUP BY 1) x),
    'por_tipo', (SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', t, 'atendimentos', n) ORDER BY n DESC), '[]'::jsonb)
        FROM (SELECT coalesce(dt.name, 'Outros') AS t, count(*) AS n
              FROM c LEFT JOIN public.demand_types dt ON dt.id = c.demand_type_id GROUP BY 1) x),
    'por_assentamento', (SELECT coalesce(jsonb_agg(jsonb_build_object('assentamento', nome, 'atendimentos', atendimentos,
          'produtores', produtores, 'horas', horas) ORDER BY atendimentos DESC), '[]'::jsonb) FROM assent_final)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.transparencia_resumo(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transparencia_resumo(int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
