-- Restore Storage access rules for delivery proof photos.
-- Files are written under the authenticated user's id as the first folder:
--   {auth.uid()}/deliveries/{driver_id}/file.jpg
--   {auth.uid()}/occurrences/{driver_id}/file.jpg

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "delivery_proofs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_staff_read" ON storage.objects;

CREATE POLICY "delivery_proofs_owner_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "delivery_proofs_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "delivery_proofs_owner_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "delivery_proofs_staff_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
  )
);
