-- Enforce tenant isolation across customer data.
-- This removes permissive authenticated policies and replaces them with
-- tenant-scoped RLS policies backed by get_user_tenant_id().

CREATE OR REPLACE FUNCTION public.is_staff_role(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
      SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY (ARRAY['admin','owner','manager','fleet_manager','dispatcher'])
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_tenant_data(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.is_staff_role(p_user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY (ARRAY['admin','owner','manager','fleet_manager','dispatcher'])
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.is_tenant_admin(p_user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.set_current_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    v_tenant_id := public.get_user_tenant_id(auth.uid());
    IF v_tenant_id IS NOT NULL THEN
      NEW.tenant_id := v_tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_access_key_key;
DROP INDEX IF EXISTS public.invoices_access_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_access_key_unique
ON public.invoices(tenant_id, access_key);

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'drivers','fleet_positions','company_vehicles','invoices','manifests',
    'manifest_audit_logs','settlements','settlement_items','settlement_audit_logs',
    'app_config','deliveries','delivery_proofs','delivery_occurrences',
    'driver_occurrences','driver_wallet','payment_history','driver_documents'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      FOR p IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;

      EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_read_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%I" ON public.%I', t, t);

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
      ) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS set_current_tenant_id_%I ON public.%I', t, t);
        EXECUTE format(
          'CREATE TRIGGER set_current_tenant_id_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_current_tenant_id()',
          t,
          t
        );

        EXECUTE format(
          'CREATE POLICY "tenant_read_%I" ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_data(tenant_id, auth.uid()))',
          t,
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()))',
          t,
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_update_%I" ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id, auth.uid())) WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()))',
          t,
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_delete_%I" ON public.%I FOR DELETE TO authenticated USING (public.can_manage_tenant(tenant_id, auth.uid()))',
          t,
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','tenant_memberships','profiles','user_roles','platform_admins','app_config'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      FOR p IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Tenants and memberships
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_insert_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_delete_tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "platform_manage_tenants" ON public.tenants;

CREATE POLICY "tenant_read_tenants"
ON public.tenants
FOR SELECT TO authenticated
USING (public.can_read_tenant_data(id, auth.uid()));

CREATE POLICY "tenant_update_tenants"
ON public.tenants
FOR UPDATE TO authenticated
USING (public.can_manage_tenant(id, auth.uid()))
WITH CHECK (public.can_manage_tenant(id, auth.uid()));

CREATE POLICY "platform_manage_tenants"
ON public.tenants
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "authenticated_insert_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "authenticated_update_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "authenticated_delete_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "tenant_read_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "tenant_manage_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "platform_manage_memberships" ON public.tenant_memberships;

CREATE POLICY "tenant_read_memberships"
ON public.tenant_memberships
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "tenant_manage_memberships"
ON public.tenant_memberships
FOR ALL TO authenticated
USING (public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "platform_manage_memberships"
ON public.tenant_memberships
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Profiles and roles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "tenant_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "tenant_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "tenant_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "platform_manage_profiles" ON public.profiles;

CREATE POLICY "tenant_read_profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.can_read_tenant_data(tenant_id, auth.uid()));

CREATE POLICY "tenant_insert_own_profile"
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()));

CREATE POLICY "tenant_update_own_profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "platform_manage_profiles"
ON public.profiles
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated_insert_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated_update_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated_delete_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "tenant_read_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "tenant_manage_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "platform_manage_user_roles" ON public.user_roles;

CREATE POLICY "tenant_read_user_roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "tenant_manage_user_roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "platform_manage_user_roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "authenticated_insert_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "authenticated_update_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "authenticated_delete_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "platform_admins_read_self" ON public.platform_admins;
DROP POLICY IF EXISTS "platform_admins_manage" ON public.platform_admins;

CREATE POLICY "platform_admins_read_self"
ON public.platform_admins
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_manage"
ON public.platform_admins
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Global non-customer settings such as the Mapbox token.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config_read_authenticated" ON public.app_config;
DROP POLICY IF EXISTS "app_config_manage_platform" ON public.app_config;

CREATE POLICY "app_config_read_authenticated"
ON public.app_config
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "app_config_manage_platform"
ON public.app_config
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Private storage buckets must not expose one tenant's files to another tenant.
UPDATE storage.buckets
SET public = false
WHERE id IN ('driver-documents', 'delivery-proofs');

DROP POLICY IF EXISTS "driver_documents_storage_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_delete" ON storage.objects;

CREATE POLICY "driver_documents_storage_tenant_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE dd.file_path = storage.objects.name
      AND (
        public.can_read_tenant_data(dd.tenant_id, auth.uid())
        OR d.user_id = auth.uid()
      )
  )
);

CREATE POLICY "driver_documents_storage_tenant_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

CREATE POLICY "driver_documents_storage_tenant_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

CREATE POLICY "driver_documents_storage_tenant_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Anyone can view delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_staff_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_update" ON storage.objects;

CREATE POLICY "delivery_proofs_owner_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_platform_admin(auth.uid())
  )
);

CREATE POLICY "delivery_proofs_owner_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "delivery_proofs_owner_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Driver app access must be limited to the driver's own tenant and assigned records.
DROP POLICY IF EXISTS "driver_read_own_driver" ON public.drivers;
DROP POLICY IF EXISTS "driver_update_own_driver" ON public.drivers;
CREATE POLICY "driver_read_own_driver"
ON public.drivers
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()));

CREATE POLICY "driver_update_own_driver"
ON public.drivers
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "driver_read_own_documents" ON public.driver_documents;
CREATE POLICY "driver_read_own_documents"
ON public.driver_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = driver_documents.driver_id
      AND d.user_id = auth.uid()
      AND public.can_access_tenant(driver_documents.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "driver_read_assigned_invoices" ON public.invoices;
DROP POLICY IF EXISTS "driver_update_assigned_invoices" ON public.invoices;
CREATE POLICY "driver_read_assigned_invoices"
ON public.invoices
FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
);

CREATE POLICY "driver_update_assigned_invoices"
ON public.invoices
FOR UPDATE TO authenticated
USING (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
)
WITH CHECK (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS "driver_read_own_manifests" ON public.manifests;
CREATE POLICY "driver_read_own_manifests"
ON public.manifests
FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
);

-- Ensure the manifest RPC cannot attach invoices from another tenant.
CREATE OR REPLACE FUNCTION public.create_manifest_with_invoices(
  p_driver_id uuid,
  p_driver_name text,
  p_driver_cpf text DEFAULT NULL,
  p_vehicle_plate text DEFAULT NULL,
  p_vehicle_type text DEFAULT NULL,
  p_is_own_fleet boolean DEFAULT false,
  p_company_vehicle_id uuid DEFAULT NULL,
  p_freight_type text DEFAULT 'fixed',
  p_freight_value numeric DEFAULT 0,
  p_per_km_value numeric DEFAULT NULL,
  p_estimated_distance numeric DEFAULT NULL,
  p_scheduled_date date DEFAULT current_date,
  p_observation text DEFAULT NULL,
  p_invoice_ids uuid[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest_id uuid;
  v_manifest_code text;
  v_manifest_number integer;
  v_tenant_id uuid;
  v_updated_count integer := 0;
  v_requested_count integer := 0;
BEGIN
  SELECT d.tenant_id INTO v_tenant_id
  FROM public.drivers d
  WHERE d.id = p_driver_id
    AND public.can_access_tenant(d.tenant_id, auth.uid());

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Motorista nao encontrado para a empresa atual.');
  END IF;

  SELECT cardinality(COALESCE(p_invoice_ids, '{}'::uuid[])) INTO v_requested_count;

  IF v_requested_count > 0 AND EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = ANY(p_invoice_ids)
      AND i.tenant_id IS DISTINCT FROM v_tenant_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Notas fiscais de outra empresa nao podem ser vinculadas.');
  END IF;

  v_manifest_code := 'ROM-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));

  INSERT INTO public.manifests (
    tenant_id, manifest_code, driver_id, driver_name, driver_cpf, vehicle_plate, vehicle_type,
    is_own_fleet, company_vehicle_id, freight_type, freight_value, per_km_value,
    estimated_distance, scheduled_date, observation, status
  ) VALUES (
    v_tenant_id, v_manifest_code, p_driver_id, p_driver_name, p_driver_cpf, p_vehicle_plate, p_vehicle_type,
    p_is_own_fleet, p_company_vehicle_id, p_freight_type, p_freight_value, p_per_km_value,
    p_estimated_distance, p_scheduled_date, p_observation, 'pending'
  )
  RETURNING id, manifest_number INTO v_manifest_id, v_manifest_number;

  UPDATE public.invoices
  SET manifest_id = v_manifest_id,
      driver_id = p_driver_id,
      status = 'in_transit',
      updated_at = now()
  WHERE id = ANY(COALESCE(p_invoice_ids, '{}'::uuid[]))
    AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> v_requested_count THEN
    RAISE EXCEPTION 'Nem todas as notas fiscais selecionadas pertencem a empresa atual.';
  END IF;

  UPDATE public.manifests
  SET deliveries_count = v_updated_count,
      total_value = COALESCE((SELECT SUM(total_value) FROM public.invoices WHERE manifest_id = v_manifest_id AND tenant_id = v_tenant_id), 0),
      total_weight = COALESCE((SELECT SUM(total_weight) FROM public.invoices WHERE manifest_id = v_manifest_id AND tenant_id = v_tenant_id), 0)
  WHERE id = v_manifest_id
    AND tenant_id = v_tenant_id;

  UPDATE public.drivers
  SET status = 'in_route',
      updated_at = now()
  WHERE id = p_driver_id
    AND tenant_id = v_tenant_id;

  RETURN json_build_object('success', true, 'manifest_id', v_manifest_id, 'manifest_code', v_manifest_code, 'manifest_number', v_manifest_number, 'invoices_linked', v_updated_count);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
