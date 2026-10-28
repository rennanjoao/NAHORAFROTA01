-- ============================================================================
-- SECURITY FIX: Remove unused p_password parameter from create_driver_complete
-- ============================================================================
-- Issue: passwords_in_rpc_params
-- The RPC function has an unused p_password parameter that increases attack
-- surface unnecessarily. Passwords should only flow through the Edge Function.
-- ============================================================================

-- Drop and recreate the function without the password parameter
CREATE OR REPLACE FUNCTION public.create_driver_complete(
  p_email text, 
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
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'viewer'::public.app_role);
  EXCEPTION WHEN unique_violation THEN
    -- Role already exists, which is fine
    NULL;
  END;

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
    COALESCE(p_vehicle_plate, 'PENDENTE'),
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