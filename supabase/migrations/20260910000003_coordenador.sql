-- ============================================================================
-- Hierarquia "Equipe interna": nível Coordenador = admin que pode TUDO, exceto
-- EXCLUIR registros e alterar funções. Enforcement no banco por GATILHOS
-- (aditivo — NÃO altera nenhuma policy RLS existente; admins plenos e operadores
-- não são afetados; service_role/auth.uid() NULL passa direto).
-- ============================================================================

-- Coordenador = admin cujo cargo (job_title) é 'Coordenador'.
CREATE OR REPLACE FUNCTION public.is_coordenador(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _uid
      AND ur.role = 'admin'
      AND p.job_title = 'Coordenador'
  );
$$;

-- Bloqueia DELETE quando o autor é Coordenador. Qualquer outro (admin pleno,
-- operador, service_role/uid nulo) passa normalmente.
CREATE OR REPLACE FUNCTION public.fn_block_coordenador_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_coordenador(auth.uid()) THEN
    RAISE EXCEPTION 'Coordenadores não podem excluir registros.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

-- Aplica o bloqueio SOMENTE nas entidades de topo (produtor, atendimento,
-- entrega, etc.). NUNCA nas tabelas-filhas (producer_demands, delivery_items,
-- operator_machinery, service_photos, ...) — elas sofrem delete+insert durante
-- edições legítimas, então bloqueá-las quebraria a edição do Coordenador.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'producers','services','deliveries','delivery_lots','machinery',
    'settlements','glebas','demand_types','machinery_maintenance',
    'responsible_technicians','fuel_usage','patrimony'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_block_coord_del_%1$s ON public.%1$s;', t);
      EXECUTE format('CREATE TRIGGER trg_block_coord_del_%1$s BEFORE DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();', t);
    END IF;
  END LOOP;
END $$;

-- Coordenador não pode alterar FUNÇÃO (job_title) de ninguém — nem a própria.
CREATE OR REPLACE FUNCTION public.fn_block_coordenador_jobtitle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_coordenador(auth.uid()) AND NEW.job_title IS DISTINCT FROM OLD.job_title THEN
    RAISE EXCEPTION 'Coordenadores não podem alterar funções.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_coord_jobtitle ON public.profiles;
CREATE TRIGGER trg_block_coord_jobtitle
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_jobtitle();

GRANT EXECUTE ON FUNCTION public.is_coordenador(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
