-- Add condition, written_off, and image_url to patrimony table
ALTER TABLE patrimony
  ADD COLUMN IF NOT EXISTS condition text CHECK (condition IN ('otimo', 'bom', 'ruim', 'pessimo')),
  ADD COLUMN IF NOT EXISTS written_off boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Ensure patrimony_number is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'patrimony'::regclass AND contype = 'u'
      AND conname = 'patrimony_patrimony_number_key'
  ) THEN
    ALTER TABLE patrimony ADD CONSTRAINT patrimony_patrimony_number_key UNIQUE (patrimony_number);
  END IF;
END $$;

-- Create storage bucket for patrimony images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patrimony-images',
  'patrimony-images',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for patrimony-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'patrimony-images: authenticated upload'
  ) THEN
    CREATE POLICY "patrimony-images: authenticated upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'patrimony-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'patrimony-images: authenticated update'
  ) THEN
    CREATE POLICY "patrimony-images: authenticated update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'patrimony-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'patrimony-images: authenticated delete'
  ) THEN
    CREATE POLICY "patrimony-images: authenticated delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'patrimony-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'patrimony-images: public read'
  ) THEN
    CREATE POLICY "patrimony-images: public read"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'patrimony-images');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
