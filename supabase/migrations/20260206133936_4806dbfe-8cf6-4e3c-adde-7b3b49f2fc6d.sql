-- =====================================================
-- FIX 1: PROFILES TABLE - Remove any overly permissive policies
-- Issue: profiles_table_public_exposure
-- Current: Any authenticated user can view all profiles
-- Fix: Only admins can see all profiles; users see only their own
-- =====================================================

-- First, let's review and fix the profiles policies
-- Drop any potentially overly permissive policies that might exist

-- Ensure the profiles table has strict RLS
-- Users can ONLY see their own profile (id = auth.uid())
-- Admins can see all profiles (for user management)

-- The deny_anonymous_profiles policy is good, keep it
-- The user-own-profile policies are good, keep them

-- The issue is likely that RLS might not be properly restrictive
-- Let's verify the policies are correct by dropping and recreating them cleanly

-- Drop existing SELECT policies to recreate with proper restrictions
DROP POLICY IF EXISTS "Admins can view all profile details" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate with explicit conditions
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles for user management"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================
-- FIX 2: DRIVERS TABLE - Tighten access to sensitive data
-- Issue: drivers_table_sensitive_data_exposure
-- Current: May have overlapping policies causing confusion
-- Fix: Ensure drivers can ONLY see their own record via user_id
-- =====================================================

-- Drop potentially problematic policies and recreate cleanly
DROP POLICY IF EXISTS "Only admins can view all driver details" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can view own record" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can update own record" ON public.drivers;

-- Recreate driver SELECT policies with strict user_id validation
-- Driver can ONLY see their own record where user_id = auth.uid()
CREATE POLICY "Drivers can view only their own record"
ON public.drivers
FOR SELECT
USING (user_id = auth.uid());

-- Admin can see all driver records (needed for fleet management)
CREATE POLICY "Admins can view all driver records"
ON public.drivers
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Driver can update only their own record
CREATE POLICY "Drivers can update only their own record"
ON public.drivers
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());