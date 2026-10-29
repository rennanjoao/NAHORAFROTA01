
-- Function to check if tenant can add more drivers based on plan limits
CREATE OR REPLACE FUNCTION public.check_driver_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_plan text;
  v_max_drivers int;
  v_current_count int;
BEGIN
  v_tenant_id := NEW.tenant_id;
  
  -- If no tenant_id, allow (will be set by other triggers)
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get tenant plan
  SELECT plan INTO v_plan FROM public.tenants WHERE id = v_tenant_id;
  
  IF v_plan IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get max drivers for plan
  SELECT (public.get_plan_limits(v_plan)::jsonb->>'max_drivers')::int INTO v_max_drivers;
  
  -- -1 means unlimited
  IF v_max_drivers = -1 THEN
    RETURN NEW;
  END IF;
  
  -- Count current drivers
  SELECT count(*) INTO v_current_count FROM public.drivers WHERE tenant_id = v_tenant_id;
  
  IF v_current_count >= v_max_drivers THEN
    RAISE EXCEPTION 'Limite de % motoristas atingido para o plano atual. Faça upgrade.', v_max_drivers;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to check if tenant can add more system users based on plan limits
CREATE OR REPLACE FUNCTION public.check_user_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_plan text;
  v_max_users int;
  v_current_count int;
  v_role text;
BEGIN
  v_tenant_id := NEW.tenant_id;
  v_role := NEW.role;
  
  -- Only check for system roles (not viewer/driver)
  IF v_role NOT IN ('admin', 'dispatcher', 'fleet_manager', 'manager', 'owner') THEN
    RETURN NEW;
  END IF;
  
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get tenant plan
  SELECT plan INTO v_plan FROM public.tenants WHERE id = v_tenant_id;
  
  IF v_plan IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get max users for plan
  SELECT (public.get_plan_limits(v_plan)::jsonb->>'max_users')::int INTO v_max_users;
  
  -- -1 means unlimited
  IF v_max_users = -1 THEN
    RETURN NEW;
  END IF;
  
  -- Count current system users for this tenant
  SELECT count(DISTINCT ur.user_id) INTO v_current_count
  FROM public.user_roles ur
  JOIN public.tenant_memberships tm ON tm.user_id = ur.user_id AND tm.tenant_id = v_tenant_id
  WHERE ur.role IN ('admin', 'dispatcher', 'fleet_manager', 'manager', 'owner');
  
  IF v_current_count >= v_max_users THEN
    RAISE EXCEPTION 'Limite de % usuários de sistema atingido para o plano atual. Faça upgrade.', v_max_users;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS enforce_driver_plan_limit ON public.drivers;
CREATE TRIGGER enforce_driver_plan_limit
  BEFORE INSERT ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_driver_plan_limit();

DROP TRIGGER IF EXISTS enforce_user_plan_limit ON public.user_roles;
CREATE TRIGGER enforce_user_plan_limit
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_plan_limit();
