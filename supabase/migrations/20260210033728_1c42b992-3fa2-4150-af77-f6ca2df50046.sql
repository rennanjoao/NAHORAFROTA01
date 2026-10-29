
-- Update get_plan_limits to separate max_users (system) and max_drivers
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan text)
 RETURNS json
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE p_plan
    WHEN 'basic' THEN '{"max_users": 1, "max_drivers": 5, "max_vehicles": 5, "realtime": false, "batch_import": false, "sla_weekly": false, "sla_drilldown": false, "financial_dashboard": false}'::json
    WHEN 'control' THEN '{"max_users": 5, "max_drivers": 20, "max_vehicles": 20, "realtime": true, "batch_import": true, "sla_weekly": true, "sla_drilldown": false, "financial_dashboard": false}'::json
    WHEN 'total' THEN '{"max_users": -1, "max_drivers": -1, "max_vehicles": -1, "realtime": true, "batch_import": true, "sla_weekly": true, "sla_drilldown": true, "financial_dashboard": true}'::json
    ELSE '{"max_users": 1, "max_drivers": 5, "max_vehicles": 5, "realtime": false, "batch_import": false, "sla_weekly": false, "sla_drilldown": false, "financial_dashboard": false}'::json
  END
$function$;

-- Update check_plan_limit to handle 'drivers' resource
CREATE OR REPLACE FUNCTION public.check_plan_limit(p_tenant_id uuid, p_resource text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_plan TEXT;
  v_limits JSON;
  v_current_count INTEGER;
  v_max INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  v_limits := public.get_plan_limits(v_plan);
  
  IF p_resource = 'users' THEN
    -- Count system users (admin, dispatcher, fleet_manager roles - NOT drivers/viewers)
    SELECT COUNT(DISTINCT tm.user_id) INTO v_current_count 
    FROM public.tenant_memberships tm
    JOIN public.user_roles ur ON ur.user_id = tm.user_id
    WHERE tm.tenant_id = p_tenant_id
    AND ur.role IN ('admin', 'dispatcher', 'fleet_manager', 'manager', 'owner');
    v_max := (v_limits->>'max_users')::integer;
  ELSIF p_resource = 'drivers' THEN
    -- Count drivers linked to this tenant
    SELECT COUNT(*) INTO v_current_count 
    FROM public.drivers 
    WHERE tenant_id = p_tenant_id;
    v_max := (v_limits->>'max_drivers')::integer;
  ELSIF p_resource = 'vehicles' THEN
    SELECT COUNT(*) INTO v_current_count FROM public.company_vehicles WHERE tenant_id = p_tenant_id;
    v_max := (v_limits->>'max_vehicles')::integer;
  ELSE
    RETURN json_build_object('allowed', true);
  END IF;
  
  IF v_max = -1 THEN
    RETURN json_build_object('allowed', true, 'current', v_current_count, 'max', -1);
  END IF;
  
  RETURN json_build_object('allowed', v_current_count < v_max, 'current', v_current_count, 'max', v_max);
END;
$function$;
