-- Fix driver document uploads for existing tenant/user records.
-- Files are stored in the private Storage bucket `driver-documents` under:
--   {driver_id}/{document_type}/{timestamp}-{file_name}

DO $$
DECLARE
  v_default_tenant_id uuid;
BEGIN
  SELECT id INTO v_default_tenant_id
  FROM public.tenants
  WHERE slug = 'rennanjoao'
  LIMIT 1;

  IF v_default_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, plan, status)
    VALUES ('Projeto de rennanjoao', 'rennanjoao', 'total', 'active')
    RETURNING id INTO v_default_tenant_id;
  END IF;

  UPDATE public.drivers
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL;

  UPDATE public.profiles
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL;

  UPDATE public.user_roles
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  SELECT DISTINCT v_default_tenant_id, user_id, 'admin'
  FROM public.user_roles
  WHERE user_id IS NOT NULL
    AND role IN ('admin'::public.app_role, 'fleet_manager'::public.app_role)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  UPDATE public.driver_documents dd
  SET tenant_id = d.tenant_id
  FROM public.drivers d
  WHERE dd.driver_id = d.id
    AND dd.tenant_id IS NULL;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "driver_documents_tenant_read" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_documents_admin_fleet_manage" ON public.driver_documents;

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
        COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
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
        AND COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
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
        AND COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
    )
  )
);

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
          COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
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
          AND COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
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
          AND COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
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
          AND COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
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
          AND COALESCE(d.tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
      )
    )
  )
);
