-- ============================================================================
-- Fotos das propriedades do produtor (cadastro): várias fotos por propriedade.
--   * producer_property_photos: property_id NULO = propriedade PRINCIPAL (a do
--     cadastro do produtor); preenchido = propriedade adicional.
--   * bucket PRIVADO property-photos (imagens, até 10 MB).
--   * só a equipe interna (administradores) lê/envia/remove; coordenador não
--     exclui; auditoria como nas demais tabelas.
--   * excluir o produtor ou a propriedade remove os registros das fotos dela.
-- Só ACRESCENTA. Nenhum dado existente é alterado. Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.producer_property_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id  uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  property_id  uuid REFERENCES public.producer_properties(id) ON DELETE CASCADE,
  file_path    text NOT NULL UNIQUE,
  file_name    text NOT NULL,
  mime_type    text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes   bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by  uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_producer_property_photos_producer ON public.producer_property_photos (producer_id);

ALTER TABLE public.producer_property_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.producer_property_photos FROM anon;
DROP POLICY IF EXISTS "producer_property_photos_admin" ON public.producer_property_photos;
CREATE POLICY "producer_property_photos_admin" ON public.producer_property_photos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_audit_producer_property_photos ON public.producer_property_photos;
CREATE TRIGGER trg_audit_producer_property_photos
  AFTER INSERT OR UPDATE OR DELETE ON public.producer_property_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

DROP TRIGGER IF EXISTS trg_block_coord_del_producer_property_photos ON public.producer_property_photos;
CREATE TRIGGER trg_block_coord_del_producer_property_photos
  BEFORE DELETE ON public.producer_property_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('property-photos', 'property-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='property_photos_insert') THEN
    CREATE POLICY "property_photos_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'property-photos' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='property_photos_select') THEN
    CREATE POLICY "property_photos_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'property-photos' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='property_photos_delete') THEN
    CREATE POLICY "property_photos_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'property-photos' AND public.has_role(auth.uid(), 'admin'::app_role)
             AND NOT public.is_coordenador(auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
