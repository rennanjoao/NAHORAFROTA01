DROP POLICY IF EXISTS "driver_documents_staff_manage" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_driver_read_own" ON public.driver_documents;

CREATE POLICY "driver_documents_tenant_read"
ON public.driver_documents
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR tenant_id = public.get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = driver_documents.driver_id
      AND (
        d.tenant_id = public.get_user_tenant_id(auth.uid())
        OR d.user_id = auth.uid()
      )
  )
);

CREATE POLICY "driver_documents_admin_fleet_manage"
ON public.driver_documents
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
    AND EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_documents.driver_id
        AND d.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
    AND EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_documents.driver_id
        AND d.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "driver_documents_storage_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_delete" ON storage.objects;

CREATE POLICY "driver_documents_storage_tenant_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND (
          d.tenant_id = public.get_user_tenant_id(auth.uid())
          OR d.user_id = auth.uid()
        )
    )
  )
);

CREATE POLICY "driver_documents_storage_admin_fleet_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (
    public.is_platform_admin(auth.uid())
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
      AND EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.tenant_id = public.get_user_tenant_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "driver_documents_storage_admin_fleet_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    public.is_platform_admin(auth.uid())
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
      AND EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.tenant_id = public.get_user_tenant_id(auth.uid())
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (
    public.is_platform_admin(auth.uid())
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
      AND EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.tenant_id = public.get_user_tenant_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "driver_documents_storage_admin_fleet_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    public.is_platform_admin(auth.uid())
    OR (
      (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
      AND EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.id::text = (storage.foldername(name))[1]
          AND d.tenant_id = public.get_user_tenant_id(auth.uid())
      )
    )
  )
);
