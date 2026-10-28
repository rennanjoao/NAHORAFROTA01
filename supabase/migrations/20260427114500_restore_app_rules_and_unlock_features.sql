-- Restore operational rules/features expected by the app on mhnzhwqroyyxpbxrylax.

UPDATE public.tenants
SET
  plan = 'total',
  max_drivers = -1,
  max_users = -1,
  max_vehicles = -1,
  status = 'active',
  updated_at = now()
WHERE slug = 'rennanjoao';

CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE COALESCE(p_plan, 'basic')
    WHEN 'total' THEN jsonb_build_object(
      'max_users', -1,
      'max_drivers', -1,
      'max_vehicles', -1,
      'realtime', true,
      'batch_import', true,
      'sla_weekly', true,
      'sla_drilldown', true,
      'financial_dashboard', true
    )
    WHEN 'control' THEN jsonb_build_object(
      'max_users', 20,
      'max_drivers', 200,
      'max_vehicles', 100,
      'realtime', true,
      'batch_import', true,
      'sla_weekly', true,
      'sla_drilldown', false,
      'financial_dashboard', false
    )
    ELSE jsonb_build_object(
      'max_users', 5,
      'max_drivers', 50,
      'max_vehicles', 20,
      'realtime', false,
      'batch_import', false,
      'sla_weekly', false,
      'sla_drilldown', false,
      'financial_dashboard', false
    )
  END
$$;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS nfe_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_full text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_street text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_neighborhood text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_state text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_zip text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS volume_quantity integer;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS observation text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS occurrence_type text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS imported_by uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS regiao_logistica text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS receiver_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS receiver_document text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xml_raw text;

UPDATE public.invoices
SET
  nfe_number = COALESCE(nfe_number, invoice_number),
  address_full = COALESCE(address_full, delivery_address, recipient_address),
  address_street = COALESCE(address_street, delivery_address, recipient_address),
  address_city = COALESCE(address_city, destination_city),
  address_state = COALESCE(address_state, destination_state),
  volume_quantity = COALESCE(volume_quantity, volume_count),
  imported_at = COALESCE(imported_at, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_access_key_unique
ON public.invoices(access_key)
WHERE access_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_imported_at ON public.invoices(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_manifest_id ON public.invoices(manifest_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices(tenant_id);

ALTER TABLE public.manifest_audit_logs ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.manifest_audit_logs ADD COLUMN IF NOT EXISTS performed_by_name text;
ALTER TABLE public.manifest_audit_logs ADD COLUMN IF NOT EXISTS user_full_name text;
ALTER TABLE public.manifest_audit_logs ADD COLUMN IF NOT EXISTS details jsonb;

ALTER TABLE public.manifests ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.manifests ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','profiles','user_roles','tenant_memberships','platform_admins',
    'drivers','fleet_positions','company_vehicles','invoices','manifests',
    'manifest_audit_logs','settlements','settlement_items','settlement_audit_logs',
    'app_config','deliveries','delivery_proofs','delivery_occurrences',
    'driver_occurrences','driver_wallet','payment_history'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%I" ON public.%I', t, t);

    EXECUTE format(
      'CREATE POLICY "authenticated_read_%I" ON public.%I FOR SELECT TO authenticated USING (true)',
      t,
      t
    );
    EXECUTE format(
      'CREATE POLICY "authenticated_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      t,
      t
    );
    EXECUTE format(
      'CREATE POLICY "authenticated_update_%I" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t,
      t
    );
    EXECUTE format(
      'CREATE POLICY "authenticated_delete_%I" ON public.%I FOR DELETE TO authenticated USING (true)',
      t,
      t
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
