-- ============================================================================
-- SEFAZ:
--   * novo tipo de serviço "Boleto GTA" (Nota Fiscal, Boleto GTA, Declaração
--     de Posse, Outros) — nenhum registro existente é alterado;
--   * a marcação "assinou a lista" sai da tela: todo atendimento lançado é de
--     quem assinou. Novos registros já nascem com signed_list = true (padrão).
--     Registros antigos ficam como estão;
--   * COMPROVANTES mensais (folhas de atendimento assinadas, imagem ou PDF):
--     tabela sefaz_comprovantes + bucket PRIVADO sefaz-comprovantes. Só
--     administradores leem/enviam/removem; auditoria como nas demais tabelas.
-- Só ACRESCENTA. Idempotente.
-- ============================================================================

ALTER TABLE public.sefaz_services DROP CONSTRAINT IF EXISTS sefaz_services_service_type_check;
ALTER TABLE public.sefaz_services ADD CONSTRAINT sefaz_services_service_type_check
  CHECK (service_type IN ('Nota Fiscal', 'Boleto GTA', 'Declaração de Posse', 'Outros'));

ALTER TABLE public.sefaz_services ALTER COLUMN signed_list SET DEFAULT true;

CREATE TABLE IF NOT EXISTS public.sefaz_comprovantes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes         date NOT NULL CHECK (extract(day FROM mes) = 1),   -- 1º dia do mês de referência
  file_path   text NOT NULL UNIQUE,                               -- no bucket privado sefaz-comprovantes
  file_name   text NOT NULL,
  mime_type   text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes  bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sefaz_comprovantes_mes ON public.sefaz_comprovantes (mes);

ALTER TABLE public.sefaz_comprovantes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sefaz_comprovantes FROM anon;
DROP POLICY IF EXISTS "sefaz_comprovantes_admin" ON public.sefaz_comprovantes;
CREATE POLICY "sefaz_comprovantes_admin" ON public.sefaz_comprovantes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_audit_sefaz_comprovantes ON public.sefaz_comprovantes;
CREATE TRIGGER trg_audit_sefaz_comprovantes
  AFTER INSERT OR UPDATE OR DELETE ON public.sefaz_comprovantes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- Coordenador não exclui registros (mesma regra do restante do sistema).
DROP TRIGGER IF EXISTS trg_block_coord_del_sefaz_comprovantes ON public.sefaz_comprovantes;
CREATE TRIGGER trg_block_coord_del_sefaz_comprovantes
  BEFORE DELETE ON public.sefaz_comprovantes
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sefaz-comprovantes', 'sefaz-comprovantes', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='sefaz_comprovantes_insert') THEN
    CREATE POLICY "sefaz_comprovantes_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'sefaz-comprovantes' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='sefaz_comprovantes_select') THEN
    CREATE POLICY "sefaz_comprovantes_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'sefaz-comprovantes' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='sefaz_comprovantes_delete') THEN
    CREATE POLICY "sefaz_comprovantes_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'sefaz-comprovantes' AND public.has_role(auth.uid(), 'admin'::app_role)
             AND NOT public.is_coordenador(auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
