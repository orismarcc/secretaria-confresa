-- ============================================================================
-- "Logística do Calcário" e "Logística do Calcário (com combustível)" viram UM
-- só tipo de serviço (pedido de 14/10/2026). Fica o "(com combustível)" — com
-- o fluxo dele (combustível calculado pela distância) — e o tipo sem
-- combustível deixa de existir.
--
--   * atendimentos (todos os status), entregas, lotes, demandas e operadores
--     que apontavam para o tipo antigo passam para o "(com combustível)";
--   * os valores já gravados dos atendimentos (litros, horas, DAM) NÃO mudam —
--     o formulário só recalcula litros quando há distância e consumo
--     preenchidos, o que os atendimentos antigos não têm;
--   * cada referência antiga vai para backup_unificar_calcario (só admin lê).
-- Se algum dos dois tipos não existir (ex.: banco de testes), não faz nada.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_unificar_calcario (
  tabela        text NOT NULL,
  registro_id   text NOT NULL,
  dados_antigos jsonb NOT NULL,
  feito_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tabela, registro_id)
);
ALTER TABLE public.backup_unificar_calcario ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_unificar_calcario FROM anon;
DROP POLICY IF EXISTS "backup_unificar_calcario_admin" ON public.backup_unificar_calcario;
CREATE POLICY "backup_unificar_calcario_admin" ON public.backup_unificar_calcario
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DO $$
DECLARE
  _antigo uuid;   -- Logística do Calcário (sem combustível)
  _novo   uuid;   -- Logística do Calcário (com combustível) — fica
  _n_serv int; _n_ent int; _n_lot int; _n_dem int;
BEGIN
  SELECT id INTO _antigo FROM public.demand_types WHERE name = 'Logística do Calcário' AND category = 'calcario' LIMIT 1;
  SELECT id INTO _novo   FROM public.demand_types WHERE name = 'Logística do Calcário (com combustível)' AND category = 'calcario' LIMIT 1;
  IF _antigo IS NULL OR _novo IS NULL THEN
    RAISE NOTICE 'Tipos de logística do calcário não encontrados — nada a fazer.';
    RETURN;
  END IF;

  -- backups
  INSERT INTO public.backup_unificar_calcario (tabela, registro_id, dados_antigos)
    SELECT 'demand_types', d.id::text, to_jsonb(d) FROM public.demand_types d WHERE d.id = _antigo
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_unificar_calcario (tabela, registro_id, dados_antigos)
    SELECT 'services', s.id::text, jsonb_build_object('demand_type_id', s.demand_type_id) FROM public.services s WHERE s.demand_type_id = _antigo
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_unificar_calcario (tabela, registro_id, dados_antigos)
    SELECT 'deliveries', x.id::text, jsonb_build_object('demand_type_id', x.demand_type_id) FROM public.deliveries x WHERE x.demand_type_id = _antigo
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_unificar_calcario (tabela, registro_id, dados_antigos)
    SELECT 'delivery_lots', x.id::text, jsonb_build_object('demand_type_id', x.demand_type_id) FROM public.delivery_lots x WHERE x.demand_type_id = _antigo
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_unificar_calcario (tabela, registro_id, dados_antigos)
    SELECT 'producer_demands', x.id::text, to_jsonb(x) FROM public.producer_demands x WHERE x.demand_type_id = _antigo
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_unificar_calcario (tabela, registro_id, dados_antigos)
    SELECT 'operator_demand_types', o.operator_id::text || '|' || o.demand_type_id::text, to_jsonb(o)
      FROM public.operator_demand_types o WHERE o.demand_type_id = _antigo
  ON CONFLICT DO NOTHING;

  -- referências → tipo que fica
  UPDATE public.services         SET demand_type_id = _novo WHERE demand_type_id = _antigo; GET DIAGNOSTICS _n_serv = ROW_COUNT;
  UPDATE public.deliveries       SET demand_type_id = _novo WHERE demand_type_id = _antigo; GET DIAGNOSTICS _n_ent  = ROW_COUNT;
  UPDATE public.delivery_lots    SET demand_type_id = _novo WHERE demand_type_id = _antigo; GET DIAGNOSTICS _n_lot  = ROW_COUNT;
  UPDATE public.producer_demands SET demand_type_id = _novo WHERE demand_type_id = _antigo; GET DIAGNOSTICS _n_dem  = ROW_COUNT;
  -- operadores: quem tinha o antigo passa a ter o que fica (sem duplicar)
  INSERT INTO public.operator_demand_types (operator_id, demand_type_id)
    SELECT operator_id, _novo FROM public.operator_demand_types WHERE demand_type_id = _antigo
  ON CONFLICT DO NOTHING;
  DELETE FROM public.operator_demand_types WHERE demand_type_id = _antigo;

  -- o tipo antigo deixa de existir
  DELETE FROM public.demand_types WHERE id = _antigo;

  RAISE NOTICE 'Logística do calcário unificada: % atendimento(s), % entrega(s), % lote(s), % demanda(s).', _n_serv, _n_ent, _n_lot, _n_dem;
END $$;

NOTIFY pgrst, 'reload schema';
