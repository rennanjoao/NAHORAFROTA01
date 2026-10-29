-- Compatibility bootstrap for the mhnzhwqroyyxpbxrylax project.
-- Adds the app's expected schema without dropping existing driver/mobile data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'fleet_manager', 'dispatcher', 'viewer');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  document text,
  email text,
  phone text,
  plan text NOT NULL DEFAULT 'basic',
  plan_started_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  max_drivers integer,
  max_users integer,
  max_vehicles integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  avatar_url text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tenants (name, slug, plan, status)
VALUES ('Projeto de rennanjoao', 'rennanjoao', 'basic', 'active')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_type text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cnh text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cnh_category text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cnh_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cnh_expiry_date date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cnh_photo_url text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_document_url text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_delay integer DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS individual_sla numeric DEFAULT 100;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS daily_sla numeric DEFAULT 100;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS deliveries_completed integer DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS total_deliveries integer DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS is_own_fleet boolean DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS finished_time timestamptz;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS banco text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS agencia text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS conta text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS tipo_conta text DEFAULT 'corrente';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS chave_pix text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS gps_signal_status text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_gps_update timestamptz;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.drivers
SET
  vehicle_plate = COALESCE(vehicle_plate, 'PENDENTE'),
  vehicle_type = COALESCE(lower(vehicle_type), 'van'),
  cnh = COALESCE(cnh, '00000000000'),
  cnh_category = COALESCE(cnh_category, 'B'),
  phone = COALESCE(phone, '00000000000'),
  avatar = COALESCE(avatar, photo_url, 'https://cdn-icons-png.flaticon.com/512/149/149071.png'),
  tenant_id = COALESCE(tenant_id, (SELECT id FROM public.tenants WHERE slug = 'rennanjoao' LIMIT 1));

ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_vehicle_type_check;
ALTER TABLE public.drivers
ADD CONSTRAINT drivers_vehicle_type_check
CHECK (vehicle_type IN ('fiorino', 'vuc', 'toco', 'truck', 'carreta', 'van', 'moto'));

ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_status_check;
ALTER TABLE public.drivers
ADD CONSTRAINT drivers_status_check
CHECK (status IN ('active', 'in_route', 'inactive', 'pending_approval'));

CREATE UNIQUE INDEX IF NOT EXISTS drivers_user_id_unique ON public.drivers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_tenant_id ON public.drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);

ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS accuracy numeric DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS current_delay integer DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS deliveries_completed integer DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS individual_sla numeric DEFAULT 100;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS total_deliveries integer DEFAULT 0;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS vehicle_plate text;
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS vehicle_type text;

UPDATE public.fleet_positions fp
SET
  driver_name = COALESCE(fp.driver_name, d.name, 'Motorista'),
  tenant_id = COALESCE(fp.tenant_id, d.tenant_id, (SELECT id FROM public.tenants WHERE slug = 'rennanjoao' LIMIT 1)),
  vehicle_plate = COALESCE(fp.vehicle_plate, d.vehicle_plate),
  vehicle_type = COALESCE(fp.vehicle_type, d.vehicle_type)
FROM public.drivers d
WHERE fp.driver_id = d.id;

CREATE TABLE IF NOT EXISTS public.company_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  plate text NOT NULL,
  type text NOT NULL DEFAULT 'Van',
  brand text,
  model text,
  year integer,
  capacity text,
  status text NOT NULL DEFAULT 'available',
  current_driver_id uuid REFERENCES public.drivers(id),
  current_driver_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  invoice_number text,
  access_key text,
  xml_content text,
  issuer_name text,
  issuer_cnpj text,
  recipient_name text,
  recipient_cnpj text,
  recipient_address text,
  delivery_address text,
  destination_city text,
  destination_state text,
  total_value numeric DEFAULT 0,
  total_weight numeric DEFAULT 0,
  volume_count integer DEFAULT 0,
  product_description text,
  issue_date date,
  status text NOT NULL DEFAULT 'pending',
  driver_id uuid REFERENCES public.drivers(id),
  manifest_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  manifest_code text UNIQUE,
  manifest_number integer GENERATED BY DEFAULT AS IDENTITY,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name text NOT NULL,
  driver_cpf text,
  vehicle_plate text,
  vehicle_type text,
  is_own_fleet boolean DEFAULT false,
  company_vehicle_id uuid REFERENCES public.company_vehicles(id) ON DELETE SET NULL,
  freight_type text NOT NULL DEFAULT 'fixed',
  freight_value numeric NOT NULL DEFAULT 0,
  per_km_value numeric,
  estimated_distance numeric,
  deliveries_count integer NOT NULL DEFAULT 0,
  total_weight numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  scheduled_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'pending',
  observation text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_manifest_id_fkey;
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES public.manifests(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.manifest_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid REFERENCES public.manifests(id) ON DELETE SET NULL,
  action text,
  action_type text,
  previous_status text,
  new_status text,
  performed_by uuid,
  user_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  driver_name text NOT NULL,
  period_start date NOT NULL DEFAULT current_date,
  period_end date,
  status text NOT NULL DEFAULT 'open',
  total_freight numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_additions numeric NOT NULL DEFAULT 0,
  net_amount numeric GENERATED ALWAYS AS (total_freight + total_additions - total_deductions) STORED,
  paid_amount numeric DEFAULT 0,
  paid_at timestamptz,
  paid_by uuid,
  payment_method text,
  payment_reference text,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  manifest_id uuid REFERENCES public.manifests(id) ON DELETE SET NULL,
  item_type text NOT NULL DEFAULT 'freight',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_deduction boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlement_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  previous_status text,
  new_status text,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  notes text
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  manifest_id uuid REFERENCES public.manifests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS manifest_id uuid REFERENCES public.manifests(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS proof_type text DEFAULT 'delivery';
ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.delivery_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  type text NOT NULL,
  description text,
  photo_url text,
  status text NOT NULL DEFAULT 'open',
  solved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.driver_occurrences ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.driver_occurrences ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';
ALTER TABLE public.driver_occurrences ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS type text DEFAULT 'credit';
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS manifest_id uuid REFERENCES public.manifests(id) ON DELETE SET NULL;
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL;
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  amount numeric NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = p_user_id LIMIT 1),
    (SELECT tenant_id FROM public.profiles WHERE id = p_user_id LIMIT 1),
    (SELECT tenant_id FROM public.drivers WHERE user_id = p_user_id LIMIT 1),
    (SELECT id FROM public.tenants WHERE slug = 'rennanjoao' LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE COALESCE(p_plan, 'basic')
    WHEN 'enterprise' THEN '{"max_drivers": 9999, "max_users": 9999, "max_vehicles": 9999}'::jsonb
    WHEN 'premium' THEN '{"max_drivers": 200, "max_users": 20, "max_vehicles": 100}'::jsonb
    ELSE '{"max_drivers": 50, "max_users": 5, "max_vehicles": 20}'::jsonb
  END
$$;

CREATE OR REPLACE FUNCTION public.update_driver_details(p_driver jsonb)
RETURNS SETOF public.drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  v_driver_id := (p_driver->>'id')::uuid;

  UPDATE public.drivers
  SET
    name = COALESCE(p_driver->>'name', name),
    phone = COALESCE(p_driver->>'phone', phone),
    cpf = COALESCE(p_driver->>'cpf', cpf),
    vehicle_plate = COALESCE(p_driver->>'vehicle_plate', vehicle_plate),
    vehicle_type = COALESCE(p_driver->>'vehicle_type', vehicle_type),
    cnh = COALESCE(p_driver->>'cnh', cnh),
    cnh_category = COALESCE(p_driver->>'cnh_category', cnh_category),
    status = COALESCE(p_driver->>'status', status),
    banco = COALESCE(p_driver->>'banco', banco),
    agencia = COALESCE(p_driver->>'agencia', agencia),
    conta = COALESCE(p_driver->>'conta', conta),
    tipo_conta = COALESCE(p_driver->>'tipo_conta', tipo_conta),
    chave_pix = COALESCE(p_driver->>'chave_pix', chave_pix),
    updated_at = now()
  WHERE id = v_driver_id;

  RETURN QUERY SELECT * FROM public.drivers WHERE id = v_driver_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_driver_complete(
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_vehicle_plate text DEFAULT NULL,
  p_vehicle_type text DEFAULT 'van'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_driver_id uuid;
  v_tenant_id uuid;
  v_vehicle_type text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  SELECT public.get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  v_vehicle_type := COALESCE(NULLIF(lower(trim(p_vehicle_type)), ''), 'van');

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuario Auth nao encontrado. Crie o login primeiro.');
  END IF;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (v_user_id, 'viewer'::public.app_role, v_tenant_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'member')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.drivers (
    user_id, name, email, phone, cpf, vehicle_plate, vehicle_type,
    status, avatar, cnh, cnh_category, individual_sla,
    deliveries_completed, total_deliveries, current_delay, tenant_id
  ) VALUES (
    v_user_id, p_name, p_email, COALESCE(p_phone, '00000000000'), COALESCE(p_cpf, '000.000.000-00'),
    COALESCE(p_vehicle_plate, 'PENDENTE'), v_vehicle_type, 'active',
    'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    '00000000000', 'B', 100, 0, 0, 0, v_tenant_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    cpf = EXCLUDED.cpf,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_type = EXCLUDED.vehicle_type,
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.drivers.tenant_id),
    updated_at = now()
  RETURNING id INTO v_driver_id;

  RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'user_id', v_user_id, 'tenant_id', v_tenant_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

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
BEGIN
  SELECT COALESCE(public.get_user_tenant_id(auth.uid()), tenant_id) INTO v_tenant_id
  FROM public.drivers WHERE id = p_driver_id;

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
  SET manifest_id = v_manifest_id, driver_id = p_driver_id, status = 'in_transit', updated_at = now()
  WHERE id = ANY(p_invoice_ids);
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.manifests
  SET deliveries_count = v_updated_count,
      total_value = COALESCE((SELECT SUM(total_value) FROM public.invoices WHERE manifest_id = v_manifest_id), 0),
      total_weight = COALESCE((SELECT SUM(total_weight) FROM public.invoices WHERE manifest_id = v_manifest_id), 0)
  WHERE id = v_manifest_id;

  UPDATE public.drivers SET status = 'in_route', updated_at = now() WHERE id = p_driver_id;

  RETURN json_build_object('success', true, 'manifest_id', v_manifest_id, 'manifest_code', v_manifest_code, 'manifest_number', v_manifest_number, 'invoices_linked', v_updated_count);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_ghost_drivers()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.drivers
  SET status = 'active'
  WHERE status = 'in_route'
    AND COALESCE(total_deliveries, 0) = 0
$$;

CREATE OR REPLACE FUNCTION public.delete_driver_complete(p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.drivers WHERE id = p_driver_id;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_complete(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.tenant_memberships WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','profiles','user_roles','tenant_memberships','platform_admins','drivers',
    'fleet_positions','company_vehicles','invoices','manifests','manifest_audit_logs',
    'settlements','settlement_items','settlement_audit_logs','app_config','deliveries',
    'delivery_proofs','delivery_occurrences','driver_occurrences','driver_wallet','payment_history'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
