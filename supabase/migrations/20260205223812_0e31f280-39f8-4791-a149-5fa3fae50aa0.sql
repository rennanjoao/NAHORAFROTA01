-- Fix: auth user creation failing due to legacy reference to missing system_users table
-- Root cause seen in logs: ERROR: relation "system_users" does not exist

CREATE OR REPLACE FUNCTION public.auto_create_driver_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only auto-create a driver profile for emails that follow the driver convention
  IF NEW.email LIKE '%@driver%' OR NEW.email LIKE '%motorista%' THEN
    -- Roles MUST live in the dedicated roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer'::public.app_role)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create a minimal driver row with all NOT NULL columns satisfied
    INSERT INTO public.drivers (
      user_id,
      name,
      phone,
      cpf,
      vehicle_plate,
      vehicle_type,
      status,
      avatar,
      cnh,
      cnh_category,
      individual_sla,
      deliveries_completed,
      total_deliveries,
      current_delay
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Motorista'),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '00000000000'),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'cpf', ''), '000.000.000-00'),
      'PENDENTE',
      'van',
      'active',
      'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      '00000000000',
      'B',
      100,
      0,
      0,
      0
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;


-- Fix: create_driver_complete was inserting an invalid enum role ('driver')
-- app_role enum is: admin | fleet_manager | dispatcher | viewer
CREATE OR REPLACE FUNCTION public.create_driver_complete(
  p_email text,
  p_password text,
  p_name text,
  p_phone text DEFAULT NULL::text,
  p_cpf text DEFAULT NULL::text,
  p_vehicle_plate text DEFAULT NULL::text,
  p_vehicle_type text DEFAULT 'van'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_driver_id UUID;
  v_result JSON;
BEGIN
  -- 1. Fetch user_id from auth by email (Auth user must exist)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário Auth não encontrado. Crie o login primeiro.');
  END IF;

  -- 2. Ensure a safe default role in the dedicated roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'viewer'::public.app_role)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Create/Upsert driver row ensuring NOT NULL fields
  INSERT INTO public.drivers (
    user_id,
    name,
    phone,
    cpf,
    vehicle_plate,
    vehicle_type,
    status,
    avatar,
    cnh,
    cnh_category,
    individual_sla,
    deliveries_completed,
    total_deliveries,
    current_delay
  ) VALUES (
    v_user_id,
    p_name,
    COALESCE(p_phone, '00000000000'),
    COALESCE(p_cpf, '000.000.000-00'),
    COALESCE(p_vehicle_plate, 'ABC-1234'),
    COALESCE(p_vehicle_type, 'van'),
    'active',
    'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    '00000000000',
    'B',
    100,
    0,
    0,
    0
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    cpf = EXCLUDED.cpf
  RETURNING id INTO v_driver_id;

  v_result := json_build_object(
    'success', true,
    'driver_id', v_driver_id,
    'user_id', v_user_id,
    'message', 'Motorista criado com sucesso!'
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;