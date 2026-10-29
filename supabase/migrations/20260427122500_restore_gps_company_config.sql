-- Restore GPS/company configuration structures expected by the app on mhnzhwqroyyxpbxrylax.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

UPDATE public.tenants
SET
  telefone = COALESCE(telefone, phone),
  cnpj = COALESCE(cnpj, document),
  razao_social = COALESCE(razao_social, name)
WHERE slug = 'rennanjoao';

ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS speed numeric DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS heading numeric DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS accuracy numeric DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS battery_level integer DEFAULT 100;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS last_update timestamptz DEFAULT now();
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS vehicle_type text;

CREATE UNIQUE INDEX IF NOT EXISTS fleet_positions_driver_id_key
  ON public.fleet_positions(driver_id);
CREATE INDEX IF NOT EXISTS idx_fleet_positions_driver ON public.fleet_positions(driver_id);
CREATE INDEX IF NOT EXISTS idx_fleet_positions_active ON public.fleet_positions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fleet_positions_last_update ON public.fleet_positions(last_update DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_positions_tenant_id ON public.fleet_positions(tenant_id);

CREATE OR REPLACE FUNCTION public.update_fleet_position_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_update = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_fleet_timestamp ON public.fleet_positions;
CREATE TRIGGER trigger_update_fleet_timestamp
BEFORE UPDATE ON public.fleet_positions
FOR EACH ROW EXECUTE FUNCTION public.update_fleet_position_timestamp();

CREATE TABLE IF NOT EXISTS public.driver_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  driver_id uuid NOT NULL,
  manifest_id uuid,
  activity_type text NOT NULL,
  client_name text,
  occurrence_type text,
  notes text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'driver_activity_logs_activity_type_check'
      AND conrelid = 'public.driver_activity_logs'::regclass
  ) THEN
    ALTER TABLE public.driver_activity_logs
      ADD CONSTRAINT driver_activity_logs_activity_type_check
      CHECK (activity_type IN ('displacement_start', 'arrival', 'delivery_complete', 'occurrence'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_driver_activity_logs_driver_id ON public.driver_activity_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_activity_logs_created_at ON public.driver_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_activity_logs_manifest_id ON public.driver_activity_logs(manifest_id);
CREATE INDEX IF NOT EXISTS idx_driver_activity_logs_tenant_id ON public.driver_activity_logs(tenant_id);

CREATE OR REPLACE VIEW public.vw_drivers_operational
WITH (security_barrier = true, security_invoker = true)
AS SELECT
  id,
  name,
  avatar,
  photo_url,
  vehicle_plate,
  vehicle_type,
  status,
  current_delay,
  individual_sla,
  daily_sla,
  deliveries_completed,
  total_deliveries,
  is_own_fleet,
  finished_time,
  last_gps_update,
  gps_signal_status,
  created_at,
  updated_at
FROM public.drivers;

CREATE OR REPLACE VIEW public.vw_drivers_with_gps_status
WITH (security_barrier = true, security_invoker = true)
AS SELECT
  d.id,
  d.name,
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
      OR d.user_id = auth.uid()
    THEN d.phone
    ELSE NULL
  END AS phone,
  d.photo_url,
  d.vehicle_plate,
  d.vehicle_type,
  d.status,
  d.gps_signal_status,
  d.last_gps_update,
  fp.latitude,
  fp.longitude,
  fp.speed,
  fp.battery_level,
  CASE
    WHEN fp.last_update > (now() - interval '5 minutes') AND fp.is_active = true THEN 'online'
    WHEN fp.last_update > (now() - interval '30 minutes') THEN 'idle'
    ELSE 'offline'
  END AS computed_gps_status
FROM public.drivers d
LEFT JOIN public.fleet_positions fp ON d.id = fp.driver_id;

CREATE OR REPLACE VIEW public.vw_invoices_for_drivers
WITH (security_barrier = true, security_invoker = true)
AS SELECT
  i.id,
  i.access_key,
  i.nfe_number,
  i.recipient_name,
  i.address_city,
  i.address_state,
  i.address_neighborhood,
  i.latitude,
  i.longitude,
  i.status,
  i.total_value,
  i.total_weight,
  i.volume_quantity,
  i.manifest_id,
  i.driver_id,
  i.delivered_at,
  i.occurrence_type,
  i.observation,
  i.receiver_name,
  i.imported_at,
  i.updated_at,
  i.regiao_logistica
FROM public.invoices i
WHERE EXISTS (
  SELECT 1
  FROM public.manifests m
  JOIN public.drivers d ON d.id = m.driver_id
  WHERE m.id = i.manifest_id
    AND d.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.get_invoice_delivery_address(p_invoice_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_id uuid;
  v_invoice record;
BEGIN
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE user_id = auth.uid();

  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Driver not found');
  END IF;

  SELECT i.id, i.address_full, i.address_street, i.address_number,
         i.address_neighborhood, i.address_city, i.address_state,
         i.address_zip, i.latitude, i.longitude, i.recipient_name
  INTO v_invoice
  FROM public.invoices i
  JOIN public.manifests m ON m.id = i.manifest_id
  WHERE i.id = p_invoice_id
    AND m.driver_id = v_driver_id
    AND m.status IN ('pending', 'in_progress', 'active', 'assigned');

  IF v_invoice.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invoice not found or not assigned to you');
  END IF;

  RETURN json_build_object(
    'success', true,
    'address_full', v_invoice.address_full,
    'address_street', v_invoice.address_street,
    'address_number', v_invoice.address_number,
    'address_neighborhood', v_invoice.address_neighborhood,
    'address_city', v_invoice.address_city,
    'address_state', v_invoice.address_state,
    'address_zip', v_invoice.address_zip,
    'latitude', v_invoice.latitude,
    'longitude', v_invoice.longitude,
    'recipient_name', v_invoice.recipient_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_fleet_positions()
RETURNS TABLE (
  id uuid,
  driver_id uuid,
  driver_name text,
  latitude numeric,
  longitude numeric,
  speed numeric,
  heading numeric,
  battery_level integer,
  last_update timestamptz,
  driver_photo text,
  vehicle_plate text,
  vehicle_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fp.id,
    fp.driver_id,
    COALESCE(fp.driver_name, d.name) AS driver_name,
    fp.latitude,
    fp.longitude,
    COALESCE(fp.speed, 0) AS speed,
    COALESCE(fp.heading, 0) AS heading,
    COALESCE(fp.battery_level, 100) AS battery_level,
    fp.last_update,
    COALESCE(d.photo, d.photo_url, d.avatar) AS driver_photo,
    COALESCE(fp.vehicle_plate, d.vehicle_plate) AS vehicle_plate,
    COALESCE(fp.vehicle_type, d.vehicle_type) AS vehicle_type
  FROM public.fleet_positions fp
  LEFT JOIN public.drivers d ON d.id = fp.driver_id
  WHERE fp.is_active = true
    AND fp.latitude IS NOT NULL
    AND fp.longitude IS NOT NULL;
$$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view own tenant" ON public.tenants;
CREATE POLICY "Tenant members can view own tenant"
ON public.tenants FOR SELECT TO authenticated
USING (id = public.get_user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON public.tenants;
CREATE POLICY "Tenant admins can update own tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (id = public.get_user_tenant_id() OR public.is_platform_admin())
WITH CHECK (id = public.get_user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated read fleet positions" ON public.fleet_positions;
CREATE POLICY "Authenticated read fleet positions"
ON public.fleet_positions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated insert fleet positions" ON public.fleet_positions;
CREATE POLICY "Authenticated insert fleet positions"
ON public.fleet_positions FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update fleet positions" ON public.fleet_positions;
CREATE POLICY "Authenticated update fleet positions"
ON public.fleet_positions FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read driver activity logs" ON public.driver_activity_logs;
CREATE POLICY "Authenticated read driver activity logs"
ON public.driver_activity_logs FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated insert driver activity logs" ON public.driver_activity_logs;
CREATE POLICY "Authenticated insert driver activity logs"
ON public.driver_activity_logs FOR INSERT TO authenticated
WITH CHECK (true);

GRANT SELECT ON public.vw_drivers_operational TO authenticated;
GRANT SELECT ON public.vw_drivers_with_gps_status TO authenticated;
GRANT SELECT ON public.vw_invoices_for_drivers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_delivery_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_fleet_positions() TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_positions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_activity_logs;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
