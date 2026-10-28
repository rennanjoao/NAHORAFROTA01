-- Fix PUBLIC_DATA_EXPOSURE: Restrict email access to admins only
-- Non-admin roles (fleet_manager, dispatcher) need names for operations but not emails

-- Drop the overly permissive policy that exposes emails to all authorized roles
DROP POLICY IF EXISTS "Authorized roles can view all profiles" ON public.profiles;

-- Create new policy: Only admins can view full profile details (including email)
CREATE POLICY "Admins can view all profile details"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a security definer function that returns operational profile data without email
-- This allows fleet_manager and dispatcher roles to see names without email exposure
CREATE OR REPLACE FUNCTION public.get_operational_profiles()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, avatar_url, created_at, updated_at
  FROM public.profiles
$$;

-- Grant execute on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_operational_profiles() TO authenticated;