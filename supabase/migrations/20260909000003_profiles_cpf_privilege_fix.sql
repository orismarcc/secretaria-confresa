-- ============================================================================
-- Correção do item 5 (profiles): o REVOKE de coluna isolado não faz efeito
-- quando existe GRANT SELECT no nível da TABELA (ele cobre todas as colunas).
-- O correto: revogar o SELECT da tabela e reconceder coluna a coluna, sem cpf.
--
-- Resultado: authenticated (admin ou operador) NÃO consegue mais ler
-- profiles.cpf diretamente; o cpf só sai pela função admin_profile_cpfs()
-- (SECURITY DEFINER, restrita a admin). Colunas usadas pelo app continuam OK.
-- ============================================================================

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, name, email, created_at, updated_at, job_title)
  ON public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
