-- ============================================================================
-- Correção pontual (a pedido): nos atendimentos de PC (operation_type='pc') com
-- DAM PAGA no assentamento PA XAVANTE, atribuir o operador ANTONIEL e a máquina
-- vinculada a ele.
--
-- Segurança:
--   * Altera SOMENTE operator_id e machinery_id. Não toca em status, datas
--     (created_at/scheduled_date/completed_at) nem em campos de DAM.
--   * Reversível: os valores antigos ficam em backup_pc_xavante_antoniel.
--   * Defensiva: só age se Antoniel for único e tiver exatamente 1 maquinário,
--     e se PA XAVANTE for único. Caso contrário, NÃO faz nada (apenas avisa) —
--     jamais quebra o deploy nem grava dado errado.
--   * Idempotente: rodar de novo não duplica backup nem altera o resultado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_pc_xavante_antoniel (
  service_id      uuid PRIMARY KEY,
  old_operator_id uuid,
  old_machinery_id uuid,
  backed_up_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_op   uuid;
  v_mach uuid;
  v_st   uuid;
  n_op int; n_mach int; n_st int; n_upd int;
BEGIN
  SELECT count(*) INTO n_op FROM public.profiles     WHERE name ILIKE '%antoniel%';
  SELECT count(*) INTO n_st FROM public.settlements  WHERE name ILIKE '%xavante%';

  IF n_op <> 1 THEN
    RAISE NOTICE 'PC/XAVANTE: abortado — % perfil(is) com "antoniel" (esperado 1).', n_op;
    RETURN;
  END IF;
  IF n_st <> 1 THEN
    RAISE NOTICE 'PC/XAVANTE: abortado — % assentamento(s) com "xavante" (esperado 1).', n_st;
    RETURN;
  END IF;

  SELECT id INTO v_op FROM public.profiles    WHERE name ILIKE '%antoniel%';
  SELECT id INTO v_st FROM public.settlements WHERE name ILIKE '%xavante%';

  SELECT count(*) INTO n_mach FROM public.operator_machinery WHERE operator_id = v_op;
  IF n_mach <> 1 THEN
    RAISE NOTICE 'PC/XAVANTE: abortado — Antoniel tem % maquinário(s) atribuído(s) (esperado 1).', n_mach;
    RETURN;
  END IF;
  SELECT machinery_id INTO v_mach FROM public.operator_machinery WHERE operator_id = v_op;

  -- Backup dos valores atuais (só os que serão alterados)
  INSERT INTO public.backup_pc_xavante_antoniel (service_id, old_operator_id, old_machinery_id)
  SELECT s.id, s.operator_id, s.machinery_id
  FROM public.services s
  JOIN public.demand_types dt ON dt.id = s.demand_type_id
  WHERE dt.operation_type = 'pc'
    AND s.dam_paid = true
    AND s.settlement_id = v_st
  ON CONFLICT (service_id) DO NOTHING;

  -- Atribui operador e máquina — nada além disso
  UPDATE public.services s
  SET operator_id = v_op,
      machinery_id = v_mach
  FROM public.demand_types dt
  WHERE dt.id = s.demand_type_id
    AND dt.operation_type = 'pc'
    AND s.dam_paid = true
    AND s.settlement_id = v_st;

  GET DIAGNOSTICS n_upd = ROW_COUNT;
  RAISE NOTICE 'PC/XAVANTE: % atendimento(s) atribuído(s) ao Antoniel (máquina %).', n_upd, v_mach;
END $$;

NOTIFY pgrst, 'reload schema';
