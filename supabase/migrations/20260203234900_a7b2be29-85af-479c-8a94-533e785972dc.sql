-- Fix 1: Remove overly permissive profiles policy that exposes emails to all users
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Keep only the restrictive "Users can view own profile" policy which already exists

-- Fix 2: Restrict fleet_positions SELECT to authorized roles only
DROP POLICY IF EXISTS "Authenticated users can read active fleet positions" ON public.fleet_positions;

-- Create new policy that restricts fleet position reads to authorized personnel or own driver
CREATE POLICY "Authorized users can read fleet positions"
ON public.fleet_positions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'fleet_manager'::app_role) 
  OR public.has_role(auth.uid(), 'dispatcher'::app_role) 
  OR driver_id = auth.uid()
);