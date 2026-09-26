-- ============================================================================
-- Ajuste do custo por hora-máquina (dados reais mostraram):
--   * nenhum abastecimento lançado em Frotas ainda → custo/hora saía R$ 0,00,
--     o que parece "custo zero". Agora fica NULO (tela mostra "—") quando não
--     há nenhum custo lançado.
--   * o combustível é lançado nos ATENDIMENTOS (services.fuel_liters). Passa a
--     ser mostrado à parte (litros_atendimentos), SEM entrar no custo — até a
--     equipe definir se representa o consumo real da máquina.
-- Função de leitura; nada é gravado.
-- ============================================================================
DROP FUNCTION IF EXISTS public.custo_maquinas(date, date);

CREATE FUNCTION public.custo_maquinas(_inicio date, _fim date)
RETURNS TABLE (
  machinery_id uuid, nome text, categoria text,
  atendimentos int, horas numeric, hectares numeric, litros_atendimentos numeric,
  litros numeric, litros_sem_preco numeric, custo_combustivel numeric,
  manutencoes int, manutencoes_sem_custo int, custo_manutencao numeric,
  custo_total numeric, custo_hora numeric, litros_hora numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH s AS (
    SELECT sv.machinery_id, count(*)::int AS atendimentos,
      coalesce(sum(sv.worked_hours), 0) AS horas, coalesce(sum(sv.worked_area), 0) AS hectares,
      coalesce(sum(sv.fuel_liters), 0) AS litros_atendimentos
    FROM public.services sv
    WHERE sv.status = 'completed' AND sv.machinery_id IS NOT NULL
      AND (sv.completed_at AT TIME ZONE 'America/Cuiaba')::date BETWEEN _inicio AND _fim
    GROUP BY sv.machinery_id
  ), a AS (
    SELECT r.machinery_id, coalesce(sum(r.liters), 0) AS litros,
      coalesce(sum(r.liters) FILTER (WHERE r.price_per_liter IS NULL), 0) AS litros_sem_preco,
      coalesce(sum(r.liters * r.price_per_liter), 0) AS custo_combustivel
    FROM public.machinery_refuels r
    WHERE (r.refueled_at AT TIME ZONE 'America/Cuiaba')::date BETWEEN _inicio AND _fim
    GROUP BY r.machinery_id
  ), m AS (
    SELECT mm.machinery_id, count(*)::int AS manutencoes,
      (count(*) FILTER (WHERE mm.cost IS NULL))::int AS manutencoes_sem_custo,
      coalesce(sum(mm.cost), 0) AS custo_manutencao
    FROM public.machinery_maintenance mm
    WHERE (mm.started_at AT TIME ZONE 'America/Cuiaba')::date BETWEEN _inicio AND _fim
    GROUP BY mm.machinery_id
  ), j AS (
    SELECT mq.id, mq.name, mq.kind,
      coalesce(s.atendimentos, 0) AS atendimentos, coalesce(s.horas, 0) AS horas,
      coalesce(s.hectares, 0) AS hectares, coalesce(s.litros_atendimentos, 0) AS litros_atendimentos,
      coalesce(a.litros, 0) AS litros, coalesce(a.litros_sem_preco, 0) AS litros_sem_preco,
      coalesce(a.custo_combustivel, 0) AS custo_combustivel,
      coalesce(m.manutencoes, 0) AS manutencoes, coalesce(m.manutencoes_sem_custo, 0) AS manutencoes_sem_custo,
      coalesce(m.custo_manutencao, 0) AS custo_manutencao
    FROM public.machinery mq
    LEFT JOIN s ON s.machinery_id = mq.id
    LEFT JOIN a ON a.machinery_id = mq.id
    LEFT JOIN m ON m.machinery_id = mq.id
    WHERE s.machinery_id IS NOT NULL OR a.machinery_id IS NOT NULL OR m.machinery_id IS NOT NULL
  )
  SELECT id, name, kind, atendimentos, round(horas, 2), round(hectares, 2), round(litros_atendimentos, 2),
    round(litros, 2), round(litros_sem_preco, 2), round(custo_combustivel, 2),
    manutencoes, manutencoes_sem_custo, round(custo_manutencao, 2),
    round(custo_combustivel + custo_manutencao, 2),
    CASE WHEN horas > 0 AND (custo_combustivel + custo_manutencao) > 0
      THEN round((custo_combustivel + custo_manutencao) / horas, 2) END,
    CASE WHEN horas > 0 AND litros > 0 THEN round(litros / horas, 2) END
  FROM j
  ORDER BY name
$$;

REVOKE EXECUTE ON FUNCTION public.custo_maquinas(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.custo_maquinas(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
