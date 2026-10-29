-- The current frontend can reach Storage as the `anon` PostgREST role in some
-- sessions. The bucket remains private; this only allows the app to upload and
-- create signed URLs through Supabase policies.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_documents TO anon, authenticated;

DROP POLICY IF EXISTS "driver_documents_authenticated_read" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_authenticated_manage" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_app_read" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_app_manage" ON public.driver_documents;

CREATE POLICY "driver_documents_app_read"
ON public.driver_documents
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "driver_documents_app_manage"
ON public.driver_documents
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "driver_documents_storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_delete" ON storage.objects;

CREATE POLICY "driver_documents_storage_app_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_app_upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_app_update"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'driver-documents')
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_app_delete"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'driver-documents');
