-- ============================================================================
-- Operadores que dividem um assentamento veem os mesmos atendimentos em aberto,
-- e quem INICIA ou FINALIZA passa a ser o operador do atendimento — mesmo que
-- estivesse cadastrado em nome do colega.
--
-- Mantém o espírito do reforço de 09/09 (sem "sequestro" de serviço alheio):
-- a exceção só vale quando o operador está EXPLICITAMENTE cadastrado no
-- assentamento do atendimento e o atendimento cabe nas restrições dele (tipo de
-- serviço e gleba). Operador sem assentamentos cadastrados NÃO ganha acesso a
-- serviço de colega. Finalizados/cancelados continuam intocáveis.
-- Nova trava (WITH CHECK): o operador só pode deixar o atendimento em NOME
-- DELE (ou sem operador, como já era) — nunca repassar a um terceiro.
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.operator_shares_service(
  _uid uuid, _settlement_id uuid, _demand_type_id uuid, _producer_id uuid, _property_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _settlement_id IS NOT NULL
    -- 1) cadastrado explicitamente no assentamento do atendimento
    AND EXISTS (
      SELECT 1 FROM operator_settlements os
      WHERE os.operator_id = _uid AND os.settlement_id = _settlement_id
    )
    -- 2) tipo de serviço: sem restrição, ou o tipo está liberado
    AND (
      NOT EXISTS (SELECT 1 FROM operator_demand_types d WHERE d.operator_id = _uid)
      OR EXISTS (SELECT 1 FROM operator_demand_types d
                 WHERE d.operator_id = _uid AND d.demand_type_id = _demand_type_id)
    )
    -- 3) gleba: se o operador restringe glebas NESTE assentamento, a gleba da
    --    propriedade atendida (adicional ou principal) tem de estar liberada
    AND (
      NOT EXISTS (
        SELECT 1 FROM operator_glebas og JOIN glebas g ON g.id = og.gleba_id
        WHERE og.operator_id = _uid AND g.settlement_id = _settlement_id
      )
      OR EXISTS (
        SELECT 1 FROM operator_glebas og
        WHERE og.operator_id = _uid
          AND og.gleba_id = CASE
            WHEN _property_id IS NOT NULL
              THEN (SELECT pp.gleba_id FROM producer_properties pp WHERE pp.id = _property_id)
            ELSE (SELECT p.gleba_id FROM producers p WHERE p.id = _producer_id)
          END
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.operator_shares_service(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_shares_service(uuid, uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Operators can update services" ON public.services;

CREATE POLICY "Operators can update services"
  ON public.services FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'operator'::app_role)
    AND (
      operator_id = auth.uid()
      OR (operator_id IS NULL AND status IN ('pending', 'proximo', 'in_progress'))
      OR (
        status IN ('pending', 'proximo', 'in_progress')
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
