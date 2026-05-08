-- Add receipt URL and paid-at date to services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS dam_receipt_url text,
  ADD COLUMN IF NOT EXISTS dam_paid_at date;

-- Create storage bucket for DAM receipts (private, 10 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dam-receipts',
  'dam-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for dam-receipts bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'dam_receipts_insert'
  ) THEN
    CREATE POLICY "dam_receipts_insert" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dam-receipts');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'dam_receipts_select'
  ) THEN
    CREATE POLICY "dam_receipts_select" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'dam-receipts');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'dam_receipts_delete'
  ) THEN
    CREATE POLICY "dam_receipts_delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'dam-receipts');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
