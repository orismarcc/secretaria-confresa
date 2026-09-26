-- ============================================================================
-- Custo por hora-máquina. Só ACRESCENTA (colunas opcionais + função de leitura):
--   * machinery_refuels.price_per_liter — preço do litro no abastecimento;
--   * machinery_refuels.hour_meter / machinery_maintenance.hour_meter —
--     leitura do horímetro (opcional, para conferência futura).
--   * custo_maquinas(inicio, fim): por máquina, no período — horas trabalhadas
--     (atendimentos finalizados), litros, custo de combustível, custo de
--     manutenção, custo total, custo/hora e litros/hora.
-- A função respeita as permissões de quem consulta (SECURITY INVOKER).
-- Registros antigos ficam como estão (sem preço = não entram no custo e são
-- sinalizados como "sem preço").
-- ============================================================================

ALTER TABLE public.machinery_refuels
  ADD COLUMN IF NOT EXISTS price_per_liter numeric(10,3),
  ADD COLUMN IF NOT EXISTS hour_meter numeric(12,1);
ALTER TABLE public.machinery_maintenance
  ADD COLUMN IF NOT EXISTS hour_meter numeric(12,1);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machinery_refuels_price_ok') THEN
    ALTER TABLE public.machinery_refuels ADD CONSTRAINT machinery_refuels_price_ok
      CHECK (price_per_liter IS NULL OR price_per_liter >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machinery_refuels_hour_meter_ok') THEN
    ALTER TABLE public.machinery_refuels ADD CONSTRAINT machinery_refuels_hour_meter_ok
      CHECK (hour_meter IS NULL OR hour_meter >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machinery_maintenance_hour_meter_ok') THEN
    ALTER TABLE public.machinery_maintenance ADD CONSTRAINT machinery_maintenance_hour_meter_ok
      CHECK (hour_meter IS NULL OR hour_meter >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.custo_maquinas(_inicio date, _fim date)
RETURNS TABLE (
  machinery_id uuid, nome text, categoria text,
  atendimentos int, horas numeric, hectares numeric,
  litros numeric, litros_sem_preco numeric, custo_combustivel numeric,
  manutencoes int, manutencoes_sem_custo int, custo_manutencao numeric,
  custo_total numeric, custo_hora numeric, litros_hora numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH s AS (
    SELECT sv.machinery_id, count(*)::int AS atendimentos,
      coalesce(sum(sv.worked_hours), 0) AS horas, coalesce(sum(sv.worked_area), 0) AS hectares
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
  )
  SELECT mq.id, mq.name, mq.kind,
    coalesce(s.atendimentos, 0), round(coalesce(s.horas, 0), 2), round(coalesce(s.hectares, 0), 2),
    round(coalesce(a.litros, 0), 2), round(coalesce(a.litros_sem_preco, 0), 2), round(coalesce(a.custo_combustivel, 0), 2),
    coalesce(m.manutencoes, 0), coalesce(m.manutencoes_sem_custo, 0), round(coalesce(m.custo_manutencao, 0), 2),
    round(coalesce(a.custo_combustivel, 0) + coalesce(m.custo_manutencao, 0), 2),
    CASE WHEN coalesce(s.horas, 0) > 0
      THEN round((coalesce(a.custo_combustivel, 0) + coalesce(m.custo_manutencao, 0)) / s.horas, 2) END,
    CASE WHEN coalesce(s.horas, 0) > 0 THEN round(coalesce(a.litros, 0) / s.horas, 2) END
  FROM public.machinery mq
  LEFT JOIN s ON s.machinery_id = mq.id
  LEFT JOIN a ON a.machinery_id = mq.id
  LEFT JOIN m ON m.machinery_id = mq.id
  WHERE s.machinery_id IS NOT NULL OR a.machinery_id IS NOT NULL OR m.machinery_id IS NOT NULL
  ORDER BY mq.name
$$;

REVOKE EXECUTE ON FUNCTION public.custo_maquinas(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.custo_maquinas(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
