CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  document_type text NOT NULL CHECK (document_type IN ('cnh', 'addressProof', 'vehicleDoc', 'trailerDoc')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON public.driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_tenant_id ON public.driver_documents(tenant_id);

ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_documents_staff_manage" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_driver_read_own" ON public.driver_documents;

CREATE POLICY "driver_documents_staff_manage"
ON public.driver_documents
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id = public.get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = driver_documents.driver_id
      AND d.tenant_id = public.get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR tenant_id = public.get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = driver_documents.driver_id
      AND d.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "driver_documents_driver_read_own"
ON public.driver_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = driver_documents.driver_id
      AND d.user_id = auth.uid()
  )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "driver_documents_storage_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_delete" ON storage.objects;

CREATE POLICY "driver_documents_storage_authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "driver_documents_storage_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'driver-documents');

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
