-- ============================================================================
-- "São Vicente" deixa de ser GLEBA de PA CONFRESA RONCADOR e passa a ser um
-- assentamento próprio: PA SÃO VICENTE (pedido de 14/10/2026).
--
--   1. Cria o assentamento PA SÃO VICENTE (se ainda não existir).
--   2. Produtores de CONFRESA RONCADOR com gleba SÃO VICENTE → PA SÃO VICENTE,
--      sem gleba. Só esses (as demais glebas e os sem gleba não mudam).
--   3. Atendimentos (ativos E finalizados) de CONFRESA RONCADOR desses
--      produtores → PA SÃO VICENTE. Atendimentos de propriedade adicional
--      seguem a gleba da propriedade (hoje não há nenhum em São Vicente).
--      Propriedades adicionais com gleba São Vicente também mudam.
--   4. Operadores — ninguém ganha nem perde acesso:
--        * quem via CONFRESA RONCADOR inteiro (sem restrição de gleba lá)
--          continua com ele e ganha PA SÃO VICENTE;
--        * quem em CONFRESA RONCADOR só via a gleba SÃO VICENTE passa a ter
--          PA SÃO VICENTE no lugar de CONFRESA RONCADOR;
--        * quem lá só via OUTRAS glebas (ex.: Canaã) não muda.
--   5. Remove a gleba SÃO VICENTE (não fica mais nada ligado a ela).
--
-- Reversível: cada valor antigo vai para backup_pa_sao_vicente (só admin lê);
-- produtores e atendimentos também ficam na auditoria. Se a gleba não existir
-- (ex.: banco de testes), não faz nada. Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_pa_sao_vicente (
  tabela        text NOT NULL,
  registro_id   text NOT NULL,
  dados_antigos jsonb NOT NULL,
  feito_em      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tabela, registro_id)
);
ALTER TABLE public.backup_pa_sao_vicente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_pa_sao_vicente FROM anon;
DROP POLICY IF EXISTS "backup_pa_sao_vicente_admin" ON public.backup_pa_sao_vicente;
CREATE POLICY "backup_pa_sao_vicente_admin" ON public.backup_pa_sao_vicente
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DO $$
DECLARE
  _cr  uuid;   -- PA CONFRESA RONCADOR
  _gsv uuid;   -- gleba SÃO VICENTE (de Confresa Roncador)
  _psv uuid;   -- novo assentamento PA SÃO VICENTE
  _n_prod int; _n_serv int; _n_prop int; _n_op_add int; _n_op_rem int;
BEGIN
  SELECT id INTO _cr FROM public.settlements WHERE upper(trim(name)) = 'PA CONFRESA RONCADOR' LIMIT 1;
  IF _cr IS NULL THEN RAISE NOTICE 'PA CONFRESA RONCADOR não encontrado — nada a fazer.'; RETURN; END IF;
  SELECT id INTO _gsv FROM public.glebas
   WHERE settlement_id = _cr AND upper(trim(name)) IN ('SÃO VICENTE', 'SAO VICENTE') LIMIT 1;
  IF _gsv IS NULL THEN RAISE NOTICE 'Gleba SÃO VICENTE não encontrada — nada a fazer.'; RETURN; END IF;

  -- 1) assentamento novo
  SELECT id INTO _psv FROM public.settlements WHERE upper(trim(name)) IN ('PA SÃO VICENTE', 'PA SAO VICENTE') LIMIT 1;
  IF _psv IS NULL THEN
    INSERT INTO public.settlements (name) VALUES ('PA SÃO VICENTE') RETURNING id INTO _psv;
  END IF;

  -- backups (antes de qualquer alteração)
  INSERT INTO public.backup_pa_sao_vicente (tabela, registro_id, dados_antigos)
    SELECT 'glebas', g.id::text, to_jsonb(g) FROM public.glebas g WHERE g.id = _gsv
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_pa_sao_vicente (tabela, registro_id, dados_antigos)
    SELECT 'producers', p.id::text, jsonb_build_object('settlement_id', p.settlement_id, 'gleba_id', p.gleba_id)
      FROM public.producers p WHERE p.gleba_id = _gsv AND p.settlement_id = _cr
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_pa_sao_vicente (tabela, registro_id, dados_antigos)
    SELECT 'producer_properties', pp.id::text, jsonb_build_object('settlement_id', pp.settlement_id, 'gleba_id', pp.gleba_id)
      FROM public.producer_properties pp WHERE pp.gleba_id = _gsv
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_pa_sao_vicente (tabela, registro_id, dados_antigos)
    SELECT 'services', s.id::text, jsonb_build_object('settlement_id', s.settlement_id)
      FROM public.services s
     WHERE s.settlement_id = _cr
       AND ( (s.property_id IS NULL AND s.producer_id IN (SELECT id FROM public.producers WHERE gleba_id = _gsv))
          OR (s.property_id IN (SELECT id FROM public.producer_properties WHERE gleba_id = _gsv)) )
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_pa_sao_vicente (tabela, registro_id, dados_antigos)
    SELECT 'operator_settlements', os.operator_id::text || '|' || os.settlement_id::text, to_jsonb(os)
      FROM public.operator_settlements os WHERE os.settlement_id = _cr
  ON CONFLICT DO NOTHING;
  INSERT INTO public.backup_pa_sao_vicente (tabela, registro_id, dados_antigos)
    SELECT 'operator_glebas', og.operator_id::text || '|' || og.gleba_id::text, to_jsonb(og)
      FROM public.operator_glebas og JOIN public.glebas g ON g.id = og.gleba_id WHERE g.settlement_id = _cr
  ON CONFLICT DO NOTHING;

  -- 3) atendimentos (antes dos produtores: o filtro usa a gleba atual)
  UPDATE public.services s SET settlement_id = _psv
   WHERE s.settlement_id = _cr
     AND ( (s.property_id IS NULL AND s.producer_id IN (SELECT id FROM public.producers WHERE gleba_id = _gsv))
        OR (s.property_id IN (SELECT id FROM public.producer_properties WHERE gleba_id = _gsv)) );
  GET DIAGNOSTICS _n_serv = ROW_COUNT;

  -- 2) produtores e propriedades adicionais
  UPDATE public.producers SET settlement_id = _psv, gleba_id = NULL
   WHERE gleba_id = _gsv AND settlement_id = _cr;
  GET DIAGNOSTICS _n_prod = ROW_COUNT;
  UPDATE public.producer_properties SET settlement_id = _psv, gleba_id = NULL WHERE gleba_id = _gsv;
  GET DIAGNOSTICS _n_prop = ROW_COUNT;

  -- 4) operadores
  --  a) quem tem CONFRESA RONCADOR e (não restringe glebas lá OU tem São Vicente liberada) ganha PA SÃO VICENTE
  INSERT INTO public.operator_settlements (operator_id, settlement_id)
    SELECT os.operator_id, _psv FROM public.operator_settlements os
     WHERE os.settlement_id = _cr
       AND ( NOT EXISTS (SELECT 1 FROM public.operator_glebas og JOIN public.glebas g ON g.id = og.gleba_id
                          WHERE og.operator_id = os.operator_id AND g.settlement_id = _cr)
          OR EXISTS (SELECT 1 FROM public.operator_glebas og WHERE og.operator_id = os.operator_id AND og.gleba_id = _gsv) )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _n_op_add = ROW_COUNT;
  --  b) quem em CONFRESA RONCADOR só via São Vicente sai de CONFRESA RONCADOR
  DELETE FROM public.operator_settlements os
   WHERE os.settlement_id = _cr
     AND EXISTS (SELECT 1 FROM public.operator_glebas og WHERE og.operator_id = os.operator_id AND og.gleba_id = _gsv)
     AND NOT EXISTS (SELECT 1 FROM public.operator_glebas og JOIN public.glebas g ON g.id = og.gleba_id
                      WHERE og.operator_id = os.operator_id AND g.settlement_id = _cr AND og.gleba_id <> _gsv);
  GET DIAGNOSTICS _n_op_rem = ROW_COUNT;
  DELETE FROM public.operator_glebas WHERE gleba_id = _gsv;

  -- 5) a gleba deixa de existir
  DELETE FROM public.glebas WHERE id = _gsv;

  RAISE NOTICE 'PA SÃO VICENTE: % produtor(es), % atendimento(s), % propriedade(s) adicional(is); operadores: +% com acesso ao novo PA, % saíram de Confresa Roncador.',
    _n_prod, _n_serv, _n_prop, _n_op_add, _n_op_rem;
END $$;

NOTIFY pgrst, 'reload schema';
