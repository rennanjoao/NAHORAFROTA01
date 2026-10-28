-- Keep driver documents in a private bucket, but avoid blocking the web app
-- when tenant/role records are incomplete for older users.

INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE public.driver_documents dd
SET tenant_id = d.tenant_id
FROM public.drivers d
WHERE dd.driver_id = d.id
  AND dd.tenant_id IS NULL;

DROP POLICY IF EXISTS "driver_documents_tenant_read" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_admin_fleet_manage" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_authenticated_read" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_authenticated_manage" ON public.driver_documents;

CREATE POLICY "driver_documents_authenticated_read"
ON public.driver_documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "driver_documents_authenticated_manage"
ON public.driver_documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "driver_documents_storage_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_delete" ON storage.objects;

CREATE POLICY "driver_documents_storage_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'driver-documents')
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'driver-documents');
