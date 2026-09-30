-- ============================================================================
-- Correção do Mapa da demanda: a "espera" comparava HOJE no fuso do servidor
-- (UTC) com a data do pedido no fuso de Cuiabá — entre 20h e meia-noite de
-- Cuiabá a espera saía com 1 dia a mais. Agora as duas datas usam Cuiabá.
-- Mesma função, mesma assinatura e mesmas permissões; só o cálculo da data.
-- ============================================================================
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
      avg((now() AT TIME ZONE 'America/Cuiaba')::date - (created_at AT TIME ZONE 'America/Cuiaba')::date) AS espera_media,
      max((now() AT TIME ZONE 'America/Cuiaba')::date - (created_at AT TIME ZONE 'America/Cuiaba')::date)::int AS espera_max
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

NOTIFY pgrst, 'reload schema';
