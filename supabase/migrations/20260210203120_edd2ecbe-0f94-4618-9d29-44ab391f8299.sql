
-- Fix 1: create_manifest_with_invoices must inject tenant_id
CREATE OR REPLACE FUNCTION public.create_manifest_with_invoices(
  p_driver_id UUID,
  p_driver_name TEXT,
  p_driver_cpf TEXT DEFAULT NULL,
  p_vehicle_plate TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT NULL,
  p_is_own_fleet BOOLEAN DEFAULT FALSE,
  p_company_vehicle_id UUID DEFAULT NULL,
  p_freight_type TEXT DEFAULT 'fixed',
  p_freight_value NUMERIC DEFAULT 0,
  p_per_km_value NUMERIC DEFAULT NULL,
  p_estimated_distance NUMERIC DEFAULT NULL,
  p_scheduled_date DATE DEFAULT CURRENT_DATE,
  p_observation TEXT DEFAULT NULL,
  p_invoice_ids UUID[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest_id UUID;
  v_manifest_code TEXT;
  v_manifest_number INTEGER;
  v_total_value NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_invoices_count INTEGER := 0;
  v_updated_count INTEGER;
  v_tenant_id UUID;
BEGIN
  -- AUTO-INJECT tenant_id from caller or driver
  SELECT public.get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM public.drivers WHERE id = p_driver_id;
  END IF;

  v_manifest_code := 'ROM-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  
  INSERT INTO public.manifests (
    manifest_code, driver_id, driver_name, driver_cpf,
    vehicle_plate, vehicle_type, is_own_fleet, company_vehicle_id,
    freight_type, freight_value, per_km_value, estimated_distance,
    deliveries_count, scheduled_date, observation, status,
    tenant_id
  ) VALUES (
    v_manifest_code, p_driver_id, p_driver_name, p_driver_cpf,
    p_vehicle_plate, p_vehicle_type, p_is_own_fleet, p_company_vehicle_id,
    p_freight_type, p_freight_value, p_per_km_value, p_estimated_distance,
    array_length(p_invoice_ids, 1), p_scheduled_date, p_observation, 'pending',
    v_tenant_id
  )
  RETURNING id, manifest_number INTO v_manifest_id, v_manifest_number;
  
  IF v_manifest_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao criar registro do romaneio';
  END IF;
  
  UPDATE public.drivers
  SET status = 'in_route', updated_at = pg_catalog.now()
  WHERE id = p_driver_id;
  
  IF p_company_vehicle_id IS NOT NULL THEN
    UPDATE public.company_vehicles
    SET status = 'in_use', current_driver_id = p_driver_id,
        current_driver_name = p_driver_name, updated_at = pg_catalog.now()
    WHERE id = p_company_vehicle_id;
  END IF;
  
  SELECT COALESCE(SUM(total_value), 0), COALESCE(SUM(total_weight), 0), COUNT(*)
  INTO v_total_value, v_total_weight, v_invoices_count
  FROM public.invoices WHERE id = ANY(p_invoice_ids);
  
  UPDATE public.invoices
  SET manifest_id = v_manifest_id, driver_id = p_driver_id,
      status = 'in_transit', updated_at = pg_catalog.now()
  WHERE id = ANY(p_invoice_ids)
    AND (manifest_id IS NULL OR status = 'pending');
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 AND array_length(p_invoice_ids, 1) > 0 THEN
    RAISE EXCEPTION 'Nenhuma NF válida para vincular. As notas já podem estar em outro romaneio.';
  END IF;
  
  UPDATE public.manifests
  SET total_value = v_total_value, total_weight = v_total_weight, deliveries_count = v_updated_count
  WHERE id = v_manifest_id;
  
  RETURN json_build_object(
    'success', true, 'manifest_id', v_manifest_id,
    'manifest_code', v_manifest_code, 'manifest_number', v_manifest_number,
    'invoices_linked', v_updated_count, 'total_value', v_total_value,
    'total_weight', v_total_weight, 'message', 'Romaneio criado com sucesso!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM, 'message', 'Erro ao gerar romaneio. As notas não foram alteradas.');
END;
$$;

-- Fix 2: auto_create_driver_on_signup must inject tenant_id from inviter context
CREATE OR REPLACE FUNCTION public.auto_create_driver_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_exists BOOLEAN;
  v_tenant_id UUID;
BEGIN
  IF public.is_driver_email(NEW.email::text) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.drivers WHERE user_id = NEW.id
    ) INTO v_driver_exists;

    IF NOT v_driver_exists THEN
      -- Try to get tenant_id from user metadata (set during invite/creation)
      v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;

      -- Fallback: get from profiles if already created
      IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = NEW.id;
      END IF;

      INSERT INTO public.user_roles (user_id, role, tenant_id)
      VALUES (NEW.id, 'viewer'::public.app_role, v_tenant_id)
      ON CONFLICT (user_id, role) DO NOTHING;

      INSERT INTO public.drivers (
        user_id, name, phone, cpf, vehicle_plate, vehicle_type,
        status, avatar, cnh, cnh_category,
        individual_sla, deliveries_completed, total_deliveries, current_delay,
        tenant_id
      ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'Motorista'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '00000000000'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'cpf', ''), '000.000.000-00'),
        'PENDENTE', 'van', 'active',
        'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        '00000000000', 'B', 100, 0, 0, 0,
        v_tenant_id
      )
      ON CONFLICT (user_id) DO NOTHING;

      -- Ensure tenant membership
      IF v_tenant_id IS NOT NULL THEN
        INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
        VALUES (v_tenant_id, NEW.id, 'member')
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix 3: Add NOT NULL default constraint to prevent future NULL tenant_ids
-- (using a trigger since we can't easily add NOT NULL to existing data flow)
CREATE OR REPLACE FUNCTION public.enforce_manifest_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    -- Try from the driver
    SELECT tenant_id INTO NEW.tenant_id FROM public.drivers WHERE id = NEW.driver_id;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    -- Try from caller
    NEW.tenant_id := public.get_user_tenant_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_manifest_tenant ON public.manifests;
CREATE TRIGGER trg_enforce_manifest_tenant
  BEFORE INSERT ON public.manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manifest_tenant_id();
