-- ============================================================================
-- Renomeia o tipo de serviço "Logística do Calcário (com combustível)" para
-- "Logística de Calcário" (pedido de 15/10/2026). SÓ o nome muda: o fluxo
-- (combustível calculado pela distância), a categoria e todos os atendimentos
-- continuam iguais (os atendimentos apontam para o tipo pelo id).
-- Para desfazer: renomear de volta para o nome antigo acima.
-- Se o tipo não existir (ex.: banco de testes), não faz nada. Idempotente.
-- ============================================================================

UPDATE public.demand_types
   SET name = 'Logística de Calcário'
 WHERE name = 'Logística do Calcário (com combustível)'
   AND category = 'calcario';

NOTIFY pgrst, 'reload schema';
