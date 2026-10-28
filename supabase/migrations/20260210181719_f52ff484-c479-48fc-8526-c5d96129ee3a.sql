
-- =============================================
-- 1. FIX RLS: profiles - Staff should only see their OWN tenant profiles
-- =============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Staff_View_All_Profiles" ON public.profiles;

-- Create tenant-isolated admin view
CREATE POLICY "Staff_View_Tenant_Profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role::text IN ('admin', 'owner', 'manager', 'fleet_manager', 'dispatcher')
  ))
  OR public.is_platform_admin(auth.uid())
);

-- =============================================
-- 2. FIX RLS: system_users - Add tenant_id filter  
-- =============================================

DROP POLICY IF EXISTS "Owner_Manage_System_Users" ON public.system_users;

CREATE POLICY "Tenant_Admin_Manage_System_Users"
ON public.system_users
FOR ALL
TO authenticated
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role::text IN ('admin', 'owner', 'manager')
  ))
  OR public.is_platform_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role::text IN ('admin', 'owner', 'manager')
  ))
  OR public.is_platform_admin(auth.uid())
);

-- =============================================
-- 3. FIX: create_driver_complete - inject tenant_id
-- =============================================

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
  v_result JSON;
BEGIN
  -- 1. Fetch user_id from auth by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário Auth não encontrado. Crie o login primeiro.');
  END IF;

  -- 2. Get caller's tenant_id to inject into driver
  SELECT public.get_user_tenant_id(auth.uid()) INTO v_tenant_id;

  -- 3. Ensure a safe default role
  BEGIN
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (v_user_id, 'viewer'::public.app_role, v_tenant_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- 4. Create/Upsert driver row with tenant_id
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
    COALESCE(p_vehicle_type, 'van'),
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
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.drivers.tenant_id)
  RETURNING id INTO v_driver_id;

  -- 5. Ensure tenant membership for the new driver user
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

-- Also fix the overloaded version with password param
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
  v_result JSON;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário Auth não encontrado.');
  END IF;

  SELECT public.get_user_tenant_id(auth.uid()) INTO v_tenant_id;

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
    COALESCE(p_vehicle_type, 'van'),
    'active',
    'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    '00000000000', 'B', 100, 0, 0, 0,
    v_tenant_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name, phone = EXCLUDED.phone, cpf = EXCLUDED.cpf,
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
