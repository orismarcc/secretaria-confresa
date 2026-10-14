-- ============================================================================
-- Entregas: acesso SÓ da equipe interna (administradores e operadores).
--
--   1. delivery_lot_summary (resumo dos lotes) era lido até SEM login: a view
--      rodava com os direitos do dono e tinha permissão para "anon". Passa a
--      respeitar as regras de acesso das tabelas (security_invoker) e perde o
--      acesso anônimo — só quem já pode ler lotes/entregas (admin/operador).
--   2. Remove a regra antiga "Admins manage deliveries" (USING true), que
--      liberava entregas para QUALQUER conta logada. Administradores e
--      operadores continuam com as regras próprias (ler, criar, editar,
--      excluir) — ninguém da equipe perde acesso.
-- Idempotente.
-- ============================================================================

ALTER VIEW public.delivery_lot_summary SET (security_invoker = true);
REVOKE ALL ON public.delivery_lot_summary FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.delivery_lot_summary FROM authenticated;
GRANT SELECT ON public.delivery_lot_summary TO authenticated;

DROP POLICY IF EXISTS "Admins manage deliveries" ON public.deliveries;

NOTIFY pgrst, 'reload schema';
