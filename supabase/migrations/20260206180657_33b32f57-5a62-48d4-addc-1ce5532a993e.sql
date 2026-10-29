-- =====================================================
-- SECURITY FIX: Restrict profiles table email exposure
-- =====================================================

-- Drop the overly permissive admin policy that exposes emails
DROP POLICY IF EXISTS "Admins can view all profiles for user management" ON public.profiles;

-- Create a more restrictive policy - admins can only view profiles when needed
-- But emails should be accessed through the secure RPC function
CREATE POLICY "Admins can view profiles for management"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() -- Users can always see their own profile
);

-- =====================================================
-- SECURITY FIX: Restrict drivers table sensitive data exposure
-- =====================================================

-- Drop existing fleet_manager policy that gives full access to sensitive data
DROP POLICY IF EXISTS "fleet_manager_manage_drivers" ON public.drivers;

-- Fleet managers should use vw_drivers_operational view for day-to-day operations
-- They should NOT have direct table access to sensitive PII
-- Create a more restrictive policy for fleet managers - READ ONLY via view
CREATE POLICY "fleet_manager_view_operational_data"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  -- Fleet managers can only see non-sensitive fields via the operational view
  -- Direct table access is blocked, they must use vw_drivers_operational
  has_role(auth.uid(), 'admin'::app_role)
  OR user_id = auth.uid()
);

-- Ensure the operational view has proper security settings
DROP VIEW IF EXISTS public.vw_drivers_operational;

CREATE VIEW public.vw_drivers_operational
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  d.id,
  d.name,
  d.avatar,
  d.vehicle_plate,
  d.vehicle_type,
  d.status,
  d.current_delay,
  d.individual_sla,
  d.daily_sla,
  d.deliveries_completed,
  d.total_deliveries,
  d.is_own_fleet,
  d.finished_time,
  d.photo_url,
  d.last_gps_update,
  d.gps_signal_status,
  d.created_at,
  d.updated_at
  -- EXPLICITLY EXCLUDED: cpf, phone, cnh, cnh_number, cnh_category, cnh_expiry_date,
  -- banco, agencia, conta, chave_pix, tipo_conta, address, user_id,
  -- emergency_contact_name, emergency_contact_phone, cnh_photo_url, vehicle_document_url
FROM public.drivers d
WHERE
  -- Admins and fleet managers can see all operational data
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'fleet_manager'::app_role)
  OR has_role(auth.uid(), 'dispatcher'::app_role)
  -- Drivers can only see their own row
  OR d.user_id = auth.uid();

-- Grant SELECT on the operational view to authenticated users
GRANT SELECT ON public.vw_drivers_operational TO authenticated;

-- =====================================================
-- Update get_operational_profiles to ensure email is excluded
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_operational_profiles()
RETURNS TABLE(id uuid, name text, avatar_url text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- SECURITY: This function explicitly excludes email addresses
  -- Only returns operational data needed for UI (name, avatar)
  SELECT p.id, p.name, p.avatar_url, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
    OR p.id = auth.uid()
$$;