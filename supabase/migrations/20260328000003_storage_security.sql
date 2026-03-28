-- Restrict service-photos bucket: 10 MB limit, images only
UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'service-photos';

-- Drop the overly broad INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;

-- Replace with role-restricted INSERT policy (operators and admins only)
CREATE POLICY "Operators and admins can upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'service-photos'
  AND (
    has_role(auth.uid(), 'operator'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Add UPDATE policy so operators can replace photos (same service folder)
CREATE POLICY "Operators and admins can update photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND (
    has_role(auth.uid(), 'operator'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
