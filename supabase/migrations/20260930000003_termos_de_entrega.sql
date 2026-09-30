-- ============================================================================
-- Entregas: comprovante / termo de entrega por produtor (arquivo anexado).
--   * tabela delivery_documents (1 entrega → N arquivos: foto ou PDF);
--   * bucket PRIVADO delivery-documents (até 10 MB por arquivo);
--   * só administradores leem/enviam/removem (a página Entregas já é restrita
--     a administradores); coordenador não exclui; auditoria como nas demais.
--   * excluir a entrega remove os registros dos arquivos dela (CASCADE).
-- Só ACRESCENTA. Nenhum dado existente é alterado. Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  file_path    text NOT NULL UNIQUE,                               -- no bucket privado delivery-documents
  file_name    text NOT NULL,
  mime_type    text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes   bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by  uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_documents_delivery ON public.delivery_documents (delivery_id);

ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_documents FROM anon;
DROP POLICY IF EXISTS "delivery_documents_admin" ON public.delivery_documents;
CREATE POLICY "delivery_documents_admin" ON public.delivery_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_audit_delivery_documents ON public.delivery_documents;
CREATE TRIGGER trg_audit_delivery_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_block_coord_del_delivery_documents ON public.delivery_documents;
CREATE TRIGGER trg_block_coord_del_delivery_documents
  BEFORE DELETE ON public.delivery_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-documents', 'delivery-documents', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='delivery_documents_insert') THEN
    CREATE POLICY "delivery_documents_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'delivery-documents' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='delivery_documents_select') THEN
    CREATE POLICY "delivery_documents_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'delivery-documents' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='delivery_documents_delete') THEN
    CREATE POLICY "delivery_documents_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'delivery-documents' AND public.has_role(auth.uid(), 'admin'::app_role)
             AND NOT public.is_coordenador(auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
