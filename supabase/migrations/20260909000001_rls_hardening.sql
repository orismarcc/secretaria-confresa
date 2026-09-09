-- ============================================================================
-- Reforço de RLS (Onda 1 da auditoria). Itens 2, 3, 4 e 9.
-- Todas as mudanças preservam o fluxo atual dos admins e do app.
-- Idempotente.
-- ============================================================================

-- ── Item 2: patrimony_transfers — apenas ADMIN altera ─────────────────────────
-- Antes: "Allow all for authenticated" (qualquer logado inseria/editava/apagava).
-- Depois: leitura para admin+operador; escrita (insert/update/delete) só admin.
DROP POLICY IF EXISTS "Allow all for authenticated"            ON public.patrimony_transfers;
DROP POLICY IF EXISTS "patrimony_transfers_select"             ON public.patrimony_transfers;
DROP POLICY IF EXISTS "patrimony_transfers_admin_write"        ON public.patrimony_transfers;

CREATE POLICY "patrimony_transfers_select"
  ON public.patrimony_transfers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "patrimony_transfers_admin_write"
  ON public.patrimony_transfers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ── Item 3: dam-receipts — apenas ADMIN apaga comprovantes ────────────────────
-- Mantém leitura/inserção como estavam (o app usa URL assinada gerada no upload
-- pelo admin); restringe só o DELETE a administradores.
DROP POLICY IF EXISTS "dam_receipts_delete"       ON storage.objects;
DROP POLICY IF EXISTS "dam_receipts_delete_admin" ON storage.objects;

CREATE POLICY "dam_receipts_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dam-receipts' AND public.has_role(auth.uid(), 'admin'::app_role));

-- ── Item 4: operador não altera atendimento atribuído a OUTRO operador ─────────
-- Antes: status IN ('pending','proximo','in_progress') OR operator_id = auth.uid()
--        → permitia mexer em qualquer pendente/próximo/execução, inclusive de colega.
-- Depois: o próprio atendimento, OU um SEM dono (pendente/próximo/execução).
--        Preserva "pegar serviço sem operador" (inclusive in_progress criado pelo
--        admin com operator_id NULL) e bloqueia sequestro de serviço alheio.
DROP POLICY IF EXISTS "Operators can update services" ON public.services;

CREATE POLICY "Operators can update services"
  ON public.services FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'operator'::app_role)
    AND (
      operator_id = auth.uid()
      OR (operator_id IS NULL AND status IN ('pending', 'proximo', 'in_progress'))
    )
  );

-- ── Item 9: auditar também mudanças de PERMISSÃO e de PERFIL ───────────────────
-- Adiciona os gatilhos de auditoria em user_roles e profiles (o CPF já é removido
-- do snapshot pela função fn_audit_log). Ambas têm coluna id (uuid).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_roles', 'profiles'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s;', t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%1$s
           AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
           FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
