
-- Fix the check_user_plan_limit function to use valid enum values only
CREATE OR REPLACE FUNCTION public.check_user_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_plan text;
  v_max_users int;
  v_current_count int;
  v_role text;
BEGIN
  v_tenant_id := NEW.tenant_id;
  v_role := NEW.role::text;
  
  -- Only check for system roles (not viewer)
  IF v_role NOT IN ('admin', 'dispatcher', 'fleet_manager') THEN
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
  
  -- Count current system users for this tenant (valid enum values only)
  SELECT count(DISTINCT ur.user_id) INTO v_current_count
  FROM public.user_roles ur
  JOIN public.tenant_memberships tm ON tm.user_id = ur.user_id AND tm.tenant_id = v_tenant_id
  WHERE ur.role::text IN ('admin', 'dispatcher', 'fleet_manager');
  
  IF v_current_count >= v_max_users THEN
    RAISE EXCEPTION 'Limite de % usuários de sistema atingido para o plano atual. Faça upgrade.', v_max_users;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
