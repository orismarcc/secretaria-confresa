-- ============================================================================
-- Atendimento EM EXECUÇÃO só pode ser alterado (finalizado) pelo operador que o
-- iniciou — ou por admin (política própria, inalterada). Operadores que dividem
-- o assentamento continuam podendo ASSUMIR atendimentos ainda NÃO iniciados
-- (pendente/próximo) do colega ao iniciá-los.
-- Ajusta 20260924000003: a exceção de compartilhamento deixa de valer para
-- 'in_progress'. Atendimento em execução SEM operador segue podendo ser pego
-- (comportamento anterior a 24/09, preservado). Idempotente.
-- ============================================================================

DROP POLICY IF EXISTS "Operators can update services" ON public.services;

CREATE POLICY "Operators can update services"
  ON public.services FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'operator'::app_role)
    AND (
      operator_id = auth.uid()
      OR (operator_id IS NULL AND status IN ('pending', 'proximo', 'in_progress'))
      OR (
        status IN ('pending', 'proximo')
        AND public.operator_shares_service(auth.uid(), settlement_id, demand_type_id, producer_id, property_id)
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'operator'::app_role)
    AND (
      operator_id = auth.uid()
      OR (operator_id IS NULL AND status IN ('pending', 'proximo', 'in_progress'))
    )
  );

NOTIFY pgrst, 'reload schema';
