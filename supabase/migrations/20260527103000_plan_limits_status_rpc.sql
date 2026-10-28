-- Stable plan/usage payload for tenant screens.
-- Keeps the UI from falling back to Basic when direct RLS reads are delayed or denied.

CREATE OR REPLACE FUNCTION public.get_current_plan_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_plan text;
  v_limits jsonb;
  v_system_users_count integer := 0;
  v_drivers_count integer := 0;
  v_vehicles_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'plan', 'basic',
      'limits', public.get_plan_limits('basic'),
      'system_users_count', 0,
      'drivers_count', 0,
      'vehicles_count', 0
    );
  END IF;

  SELECT public.get_user_tenant_id(v_user_id) INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'plan', 'basic',
      'limits', public.get_plan_limits('basic'),
      'system_users_count', 0,
      'drivers_count', 0,
      'vehicles_count', 0
    );
  END IF;

  SELECT COALESCE(t.plan, 'basic') INTO v_plan
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  v_plan := COALESCE(v_plan, 'basic');
  v_limits := public.get_plan_limits(v_plan);

  SELECT COUNT(DISTINCT ur.user_id) INTO v_system_users_count
  FROM public.user_roles ur
  WHERE ur.tenant_id = v_tenant_id
    AND ur.role::text = ANY (ARRAY['admin', 'dispatcher', 'fleet_manager', 'manager', 'owner']);

  SELECT COUNT(*) INTO v_drivers_count
  FROM public.drivers d
  WHERE d.tenant_id = v_tenant_id;

  SELECT COUNT(*) INTO v_vehicles_count
  FROM public.company_vehicles cv
  WHERE cv.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'plan', v_plan,
    'limits', v_limits,
    'system_users_count', COALESCE(v_system_users_count, 0),
    'drivers_count', COALESCE(v_drivers_count, 0),
    'vehicles_count', COALESCE(v_vehicles_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_plan_status() TO authenticated;
