-- ============================================================================
-- Item 5 (parte B): CPF de PRODUTORES invisível para operadores.
--
-- Mesmo padrão validado em profiles: revogar o SELECT da TABELA e reconceder
-- coluna a coluna (sem cpf e sem cpf_encrypted). O cpf sai apenas pela função
-- SECURITY DEFINER admin_producer_cpfs(), restrita a administradores.
--
-- O front-end (admin) reanexa o cpf via essa função em useProducers e
-- useDeliveries, então todo o consumo de p.cpf continua funcionando para admins.
-- Operadores nunca liam cpf de produtor no app; agora também não conseguem pela
-- API. INSERT/UPDATE de cpf seguem permitidos (privilégios distintos de SELECT).
-- ============================================================================

REVOKE SELECT ON public.producers FROM anon, authenticated;

GRANT SELECT (
  id, name, phone, settlement_id, location_id, property_name, property_size,
  dap_cap, created_at, location_name, latitude, longitude, caf, updated_at, gleba_id
) ON public.producers TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_producer_cpfs()
RETURNS TABLE (id uuid, cpf text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.cpf
  FROM public.producers p
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.admin_producer_cpfs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_producer_cpfs() TO authenticated;

NOTIFY pgrst, 'reload schema';
