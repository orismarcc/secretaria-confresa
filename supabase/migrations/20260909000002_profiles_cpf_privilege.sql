-- ============================================================================
-- Item 5 (parte A): CPF de USUÁRIOS invisível para operadores.
--
-- Postgres não faz RLS por coluna, e admin/operador usam o mesmo papel de banco
-- (authenticated). Solução: revogar o SELECT da coluna cpf de profiles para
-- todos os clientes e expor o cpf apenas a administradores via função
-- SECURITY DEFINER (que roda como dona da tabela e checa has_role('admin')).
--
-- Impacto no fluxo: nenhum para operadores (nunca liam cpf de usuário). Para
-- admins, a tela de Colaboradores passa a ler o cpf pela função admin_profile_cpfs().
-- ============================================================================

REVOKE SELECT (cpf) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_profile_cpfs()
RETURNS TABLE (id uuid, cpf text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.cpf
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.admin_profile_cpfs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_profile_cpfs() TO authenticated;

NOTIFY pgrst, 'reload schema';
