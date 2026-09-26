-- ============================================================================
-- Preenche máquina (e operador, se vazio) nos atendimentos FINALIZADOS de:
--   * Grade           → TRATOR YTO VERMELHO, operador GIL
--   * Pá Carregadeira → PÁ CARREGADEIRA LONKING, operador GIL
-- Informação dada pela equipe (26/09/2026). SÓ preenche campos VAZIOS — o que
-- já tem máquina/operador não é tocado (há 6 com outra máquina, a revisar).
-- Valores anteriores guardados em backup_grade_pa_maquina (só admin) para
-- desfazer. Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_grade_pa_maquina (
  service_id       uuid PRIMARY KEY,
  old_machinery_id uuid,
  old_operator_id  uuid,
  backed_up_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.backup_grade_pa_maquina ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_grade_pa_maquina FROM anon;
DROP POLICY IF EXISTS "backup_grade_pa_admin" ON public.backup_grade_pa_maquina;
CREATE POLICY "backup_grade_pa_admin" ON public.backup_grade_pa_maquina
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DO $$
DECLARE
  _gil   uuid := '11002ace-0788-4e96-bf78-8beef85b3ca6';
  _grade uuid := 'e9b94806-8f6a-46af-8bd4-dec47e872519';
  _pa    uuid := '66ea0370-d5d2-4648-ad23-d4dab10082ec';
  _yto   uuid := '88649398-3969-4d4f-854d-2fff27e93508';
  _lonk  uuid := '5cca67dc-4fb3-46ad-86c2-3822a991732c';
  _n int;
BEGIN
  -- Só age se todos os registros de referência existirem (no banco de testes
  -- do CI eles não existem: nada acontece).
  IF (SELECT count(*) FROM public.profiles WHERE id = _gil) = 0
     OR (SELECT count(*) FROM public.demand_types WHERE id IN (_grade, _pa)) < 2
     OR (SELECT count(*) FROM public.machinery WHERE id IN (_yto, _lonk)) < 2 THEN
    RAISE NOTICE 'Referências não encontradas — nada alterado.';
    RETURN;
  END IF;

  INSERT INTO public.backup_grade_pa_maquina (service_id, old_machinery_id, old_operator_id)
  SELECT s.id, s.machinery_id, s.operator_id
  FROM public.services s
  WHERE s.status = 'completed' AND s.demand_type_id IN (_grade, _pa)
    AND (s.machinery_id IS NULL OR s.operator_id IS NULL)
  ON CONFLICT (service_id) DO NOTHING;

  UPDATE public.services s SET
    machinery_id = coalesce(s.machinery_id, CASE s.demand_type_id WHEN _grade THEN _yto ELSE _lonk END),
    operator_id  = coalesce(s.operator_id, _gil)
  WHERE s.status = 'completed' AND s.demand_type_id IN (_grade, _pa)
    AND (s.machinery_id IS NULL OR s.operator_id IS NULL);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RAISE NOTICE 'Atendimentos de Grade/Pá Carregadeira preenchidos: %', _n;
END $$;

NOTIFY pgrst, 'reload schema';
