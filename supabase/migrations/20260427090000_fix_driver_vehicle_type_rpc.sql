-- Keep create_driver_complete from preserving the trigger default ("van")
-- when the driver row was auto-created during login creation.
ALTER TABLE public.drivers
DROP CONSTRAINT IF EXISTS drivers_vehicle_type_check;

UPDATE public.drivers
SET vehicle_type = lower(vehicle_type)
WHERE vehicle_type IS NOT NULL;

ALTER TABLE public.drivers
ADD CONSTRAINT drivers_vehicle_type_check
CHECK (
  vehicle_type IN (
    'fiorino',
    'vuc',
    'toco',
    'truck',
    'carreta',
    'van',
    'moto'
  )
);

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
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_driver_id UUID;
  v_tenant_id UUID;
  v_vehicle_type TEXT;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuario Auth nao encontrado. Crie o login primeiro.');
  END IF;

  SELECT public.get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  v_vehicle_type := COALESCE(NULLIF(lower(trim(p_vehicle_type)), ''), 'van');

  BEGIN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (v_user_id, 'viewer'::public.app_role, v_tenant_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO public.drivers (
    user_id, name, phone, cpf, vehicle_plate, vehicle_type,
    status, avatar, cnh, cnh_category,
    individual_sla, deliveries_completed, total_deliveries, current_delay,
    tenant_id
  ) VALUES (
    v_user_id, p_name,
    COALESCE(p_phone, '00000000000'),
    COALESCE(p_cpf, '000.000.000-00'),
    COALESCE(p_vehicle_plate, 'PENDENTE'),
    v_vehicle_type,
    'active',
    'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    '00000000000', 'B',
    100, 0, 0, 0,
    v_tenant_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    cpf = EXCLUDED.cpf,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_type = EXCLUDED.vehicle_type,
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.drivers.tenant_id)
  RETURNING id INTO v_driver_id;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'member')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true,
    'driver_id', v_driver_id,
    'user_id', v_user_id,
    'tenant_id', v_tenant_id,
    'message', 'Motorista criado com sucesso!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_driver_complete(
  p_email text,
  p_password text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_vehicle_plate text DEFAULT NULL,
  p_vehicle_type text DEFAULT 'van'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_driver_id UUID;
  v_tenant_id UUID;
  v_vehicle_type TEXT;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuario Auth nao encontrado.');
  END IF;

  SELECT public.get_user_tenant_id(auth.uid()) INTO v_tenant_id;
  v_vehicle_type := COALESCE(NULLIF(lower(trim(p_vehicle_type)), ''), 'van');

  BEGIN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (v_user_id, 'viewer'::public.app_role, v_tenant_id);
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO public.drivers (
    user_id, name, phone, cpf, vehicle_plate, vehicle_type,
    status, avatar, cnh, cnh_category,
    individual_sla, deliveries_completed, total_deliveries, current_delay,
    tenant_id
  ) VALUES (
    v_user_id, p_name,
    COALESCE(p_phone, '00000000000'),
    COALESCE(p_cpf, '000.000.000-00'),
    COALESCE(p_vehicle_plate, 'PENDENTE'),
    v_vehicle_type,
    'active',
    'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    '00000000000', 'B', 100, 0, 0, 0,
    v_tenant_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    cpf = EXCLUDED.cpf,
    vehicle_plate = EXCLUDED.vehicle_plate,
    vehicle_type = EXCLUDED.vehicle_type,
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.drivers.tenant_id)
  RETURNING id INTO v_driver_id;

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'member')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true, 'driver_id', v_driver_id,
    'user_id', v_user_id, 'tenant_id', v_tenant_id,
    'message', 'Motorista criado com sucesso!'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;
