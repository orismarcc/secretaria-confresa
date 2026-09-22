-- ============================================================================
-- Correção de segurança: a tabela de backup pontual criada em 14/09
-- (backup_pc_xavante_antoniel) ficou no schema public SEM RLS — apontada pelo
-- Security Advisor do Supabase. Habilita RLS e restringe o acesso a
-- administradores (sem RLS, a chave anon poderia ler/alterar/excluir).
-- Idempotente.
-- ============================================================================

ALTER TABLE IF EXISTS public.backup_pc_xavante_antoniel ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'backup_pc_xavante_antoniel') THEN
    DROP POLICY IF EXISTS "backup_pc_xavante_admin" ON public.backup_pc_xavante_antoniel;
    CREATE POLICY "backup_pc_xavante_admin" ON public.backup_pc_xavante_antoniel
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
