-- ============================================================
-- Foto de perfil para colaboradores (operadores/admins = profiles) e para
-- responsáveis técnicos. Bucket privado 'avatars' (URL assinada de longa
-- duração, como os comprovantes de DAM). Baixa sensibilidade, mas mantido
-- privado por consistência de segurança.
-- ============================================================

-- Colunas de foto
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.responsible_technicians
  ADD COLUMN IF NOT EXISTS photo_url text;

-- profiles teve o SELECT reconcedido coluna a coluna (item 5); a nova coluna
-- precisa ser concedida explicitamente para ser legível pelo app.
GRANT SELECT (avatar_url) ON public.profiles TO authenticated;

-- Bucket privado de avatares (5 MB, imagens).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 5242880,
        ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Políticas: qualquer autenticado pode enviar/ver/atualizar/remover no bucket
-- de avatares (o app controla quem edita o quê; a exibição usa URL assinada).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_insert') THEN
    CREATE POLICY "avatars_insert" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_select') THEN
    CREATE POLICY "avatars_select" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_update') THEN
    CREATE POLICY "avatars_update" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_delete') THEN
    CREATE POLICY "avatars_delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'avatars');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
