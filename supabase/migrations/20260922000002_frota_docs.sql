-- ============================================================================
-- Frotas: separa maquinários de veículos, documentação por item (opcional) com
-- validade/responsável/arquivo, e CNH dos operadores — para alertas de
-- vencimento. Aditivo e idempotente. RLS: admins gerenciam; leitura autenticada.
-- ============================================================================

-- 1) Tipo do item da frota: 'maquinario' (padrão) ou 'veiculo' -----------------
ALTER TABLE public.machinery
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'maquinario';
UPDATE public.machinery SET kind = 'maquinario' WHERE kind IS NULL;

-- 2) Documentos da frota (CRLV, RENAVAM, Licenciamento, Seguro, Laudo, etc.) ---
CREATE TABLE IF NOT EXISTS public.fleet_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  doc_type     text NOT NULL,                 -- CRLV, RENAVAM, LICENCIAMENTO, SEGURO, LAUDO, CONTRATO, NOTA_FISCAL, REVISAO, OUTRO
  description  text,
  responsavel  text,
  validade     date,                          -- opcional (RENAVAM/NF não vencem)
  file_path    text,                          -- caminho no bucket fleet-docs (opcional)
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_documents_machinery ON public.fleet_documents (machinery_id);
CREATE INDEX IF NOT EXISTS idx_fleet_documents_validade  ON public.fleet_documents (validade);

ALTER TABLE public.fleet_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage fleet_documents" ON public.fleet_documents;
CREATE POLICY "Admins manage fleet_documents" ON public.fleet_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Fleet documents readable by authenticated" ON public.fleet_documents;
CREATE POLICY "Fleet documents readable by authenticated" ON public.fleet_documents
  FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_documents TO authenticated;

-- 3) CNH dos operadores (para alertas) — tabela própria (não mexe em profiles) --
CREATE TABLE IF NOT EXISTS public.driver_licenses (
  operator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  numero      text,
  categoria   text,
  validade    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage driver_licenses" ON public.driver_licenses;
CREATE POLICY "Admins manage driver_licenses" ON public.driver_licenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- Leitura: admin vê todas; o próprio operador vê a sua (para eventual aviso).
DROP POLICY IF EXISTS "Driver licenses select" ON public.driver_licenses;
CREATE POLICY "Driver licenses select" ON public.driver_licenses
  FOR SELECT TO authenticated
  USING (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_licenses TO authenticated;

-- 4) Bucket privado para os arquivos dos documentos da frota -------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fleet-docs', 'fleet-docs', false, 15728640,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='fleet_docs_insert') THEN
    CREATE POLICY "fleet_docs_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'fleet-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='fleet_docs_select') THEN
    CREATE POLICY "fleet_docs_select" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'fleet-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='fleet_docs_delete') THEN
    CREATE POLICY "fleet_docs_delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'fleet-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
