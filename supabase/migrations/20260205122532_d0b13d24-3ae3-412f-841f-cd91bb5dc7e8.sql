-- ============================================
-- SECURITY FIX: Fix RLS policies for sensitive tables
-- ============================================

-- 1. FIX: system_users table - Enable RLS and add proper policies
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view all system users
CREATE POLICY "Admins can view all system users"
ON public.system_users
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own system_users record
CREATE POLICY "Users can view own system user record"
ON public.system_users
FOR SELECT
USING (user_id = auth.uid());

-- Only admins can insert system users
CREATE POLICY "Admins can insert system users"
ON public.system_users
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update system users
CREATE POLICY "Admins can update system users"
ON public.system_users
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete system users
CREATE POLICY "Admins can delete system users"
ON public.system_users
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. FIX: drivers table - Replace overly permissive policy
-- Drop the permissive authenticated-only policy
DROP POLICY IF EXISTS "drivers_select_authenticated" ON public.drivers;

-- Create restrictive SELECT policies for drivers table
-- Admins and fleet managers can view all driver data
CREATE POLICY "Admins and fleet managers can view all drivers"
ON public.drivers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
);

-- Dispatchers can view operational driver data (needed for manifest creation)
CREATE POLICY "Dispatchers can view driver operational data"
ON public.drivers
FOR SELECT
USING (has_role(auth.uid(), 'dispatcher'::app_role));

-- Drivers can view their own data
CREATE POLICY "Drivers can view own record"
ON public.drivers
FOR SELECT
USING (user_id = auth.uid());

-- 3. FIX: manifests table - Replace overly permissive policy
-- Drop the permissive authenticated-only policy
DROP POLICY IF EXISTS "manifests_select_authenticated" ON public.manifests;

-- Create restrictive SELECT policies for manifests table
-- Admins and fleet managers can view all manifests
CREATE POLICY "Admins and fleet managers can view all manifests"
ON public.manifests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
);

-- Dispatchers can view all manifests (needed for operations)
CREATE POLICY "Dispatchers can view all manifests"
ON public.manifests
FOR SELECT
USING (has_role(auth.uid(), 'dispatcher'::app_role));

-- Drivers can view their own manifests
CREATE POLICY "Drivers can view own manifests"
ON public.manifests
FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE user_id = auth.uid()
));

-- 4. FIX: profiles table - Remove overly permissive policy
-- Drop the overly permissive policy that exposes all emails
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- The existing policies remain:
-- - "Users can view own profile" (users see their own)
-- - "Admins can view all profile details" (admins see all)
-- Application should use get_operational_profiles() for non-admin users

-- 5. FIX: fleet_positions table - Replace overly permissive policy
DROP POLICY IF EXISTS "positions_select_authenticated" ON public.fleet_positions;

-- Admins, fleet managers, and dispatchers can view all positions
CREATE POLICY "Authorized users can view fleet positions"
ON public.fleet_positions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role)
);

-- Drivers can view their own position
CREATE POLICY "Drivers can view own position"
ON public.fleet_positions
FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE user_id = auth.uid()
));