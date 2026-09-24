-- ============================================================================
-- Correção de dados (a pedido): TODOS os atendimentos de PC — qualquer
-- situação (pendente, próximo, em execução, finalizado, cancelado) — passam a
-- ter área trabalhada = 0,5 ha.
--
-- Quais são "PC": o mesmo critério do restante do sistema (Análises):
--   tipos de serviço com operation_type = 'pc'; se não houver nenhum assim
--   marcado, cai para os nomes de PC (igual ao preenchimento original).
--
-- Segurança:
--   * Altera SOMENTE services.worked_area. Não toca em status, datas, DAM,
--     operador, horas nem combustível.
--   * Reversível: o valor antigo de cada atendimento fica em
--     backup_pc_area_05 (RLS ativa desde a criação — só admin lê/escreve).
--     Cada alteração também fica na auditoria (audit_log).
--   * Idempotente: rodar de novo não duplica o backup nem altera o resultado.
--   * Registra no log do deploy (NOTICE) os tipos considerados PC e as contagens.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_pc_area_05 (
  service_id      uuid PRIMARY KEY,
  old_worked_area numeric,
  backed_up_at    timestamptz NOT NULL DEFAULT now()
);

-- Protegida desde o início (lição do alerta de 19/09 na tabela de backup).
ALTER TABLE public.backup_pc_area_05 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backup_pc_area_05_admin" ON public.backup_pc_area_05;
CREATE POLICY "backup_pc_area_05_admin" ON public.backup_pc_area_05
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.backup_pc_area_05 FROM anon;

DO $$
DECLARE
  n_types int;
  v_types text;
  n_total int;
  n_backup int;
  n_upd int;
  v_status text;
BEGIN
  CREATE TEMP TABLE _pc_types ON COMMIT DROP AS
    SELECT id, name FROM public.demand_types WHERE operation_type = 'pc';

  IF NOT EXISTS (SELECT 1 FROM _pc_types) THEN
    INSERT INTO _pc_types
      SELECT id, name FROM public.demand_types
      WHERE UPPER(TRIM(name)) = 'PC' OR name ILIKE '% pc%' OR name ILIKE 'pc %';
  END IF;

  SELECT count(*), string_agg(name, ' | ' ORDER BY name) INTO n_types, v_types FROM _pc_types;
  IF n_types = 0 THEN
    RAISE NOTICE 'PC área 0,5: nenhum tipo de serviço PC encontrado — nada foi alterado.';
    RETURN;
  END IF;
  RAISE NOTICE 'PC área 0,5: % tipo(s) considerado(s) PC: %', n_types, v_types;

  SELECT count(*) INTO n_total FROM public.services
  WHERE demand_type_id IN (SELECT id FROM _pc_types);

  SELECT string_agg(status || '=' || c, ', ' ORDER BY status) INTO v_status
  FROM (SELECT status, count(*) c FROM public.services
        WHERE demand_type_id IN (SELECT id FROM _pc_types) GROUP BY status) x;

  -- Guarda o valor antigo SÓ na primeira execução (não sobrescreve o backup).
  INSERT INTO public.backup_pc_area_05 (service_id, old_worked_area)
  SELECT id, worked_area FROM public.services
  WHERE demand_type_id IN (SELECT id FROM _pc_types)
  ON CONFLICT (service_id) DO NOTHING;
  GET DIAGNOSTICS n_backup = ROW_COUNT;

  UPDATE public.services SET worked_area = 0.5
  WHERE demand_type_id IN (SELECT id FROM _pc_types)
    AND worked_area IS DISTINCT FROM 0.5;
  GET DIAGNOSTICS n_upd = ROW_COUNT;

  RAISE NOTICE 'PC área 0,5: % atendimento(s) de PC (%); % alterado(s) para 0,5 ha; % valor(es) antigo(s) guardado(s) em backup_pc_area_05.',
    n_total, coalesce(v_status, '-'), n_upd, n_backup;
END $$;

NOTIFY pgrst, 'reload schema';
