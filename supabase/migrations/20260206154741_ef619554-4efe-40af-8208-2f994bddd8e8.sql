-- ============================================================================
-- SECURITY FIX: Harden RLS Policies for Profiles and Drivers Tables
-- ============================================================================
-- Issue 1: profiles table - Email harvesting risk from overlapping policies
-- Issue 2: drivers table - Financial data exposure from complex policy set
-- ============================================================================

-- Step 1: Revoke anon SELECT on profiles (belt-and-suspenders)
REVOKE SELECT ON public.profiles FROM anon;

-- Step 2: Drop redundant/problematic policies on profiles
DROP POLICY IF EXISTS "deny_anonymous_profiles" ON public.profiles;

-- Step 3: Create RESTRICTIVE auth-required policy for profiles
CREATE POLICY "require_authenticated_profiles"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- Fix drivers table - Remove overlapping policies, keep clean model
-- ============================================================================

-- Step 4: Drop redundant overlapping policies on drivers
-- Keep: require_authenticated_drivers (RESTRICTIVE), Admins can view all, Driver View Own
DROP POLICY IF EXISTS "Driver Update Own" ON public.drivers;
DROP POLICY IF EXISTS "Driver View Own Profile" ON public.drivers;
DROP POLICY IF EXISTS "Admin Full Access Drivers" ON public.drivers;
DROP POLICY IF EXISTS "Strict: Admin Manage All" ON public.drivers;
DROP POLICY IF EXISTS "Strict: Driver View Own" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete_admin" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert_admin" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update_admin_or_self" ON public.drivers;

-- Step 5: Create clean, non-overlapping policies for drivers

-- Admin full access to all driver records (including sensitive financial data)
CREATE POLICY "admin_full_access_drivers"
  ON public.drivers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fleet managers can INSERT and UPDATE (for operational needs)
CREATE POLICY "fleet_manager_manage_drivers"
  ON public.drivers
  FOR ALL
  USING (has_role(auth.uid(), 'fleet_manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'fleet_manager'::app_role));

-- Driver can view and update ONLY their own record
CREATE POLICY "driver_view_own_record"
  ON public.drivers
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "driver_update_own_record"
  ON public.drivers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Recreate vw_drivers_operational with security_invoker for PII protection
-- ============================================================================

-- Step 6: Drop and recreate the operational view with proper security settings
DROP VIEW IF EXISTS public.vw_drivers_operational;

CREATE VIEW public.vw_drivers_operational
WITH (security_invoker = true, security_barrier = true)
AS SELECT
  id,
  name,
  avatar,
  photo_url,
  vehicle_plate,
  vehicle_type,
  status,
  current_delay,
  individual_sla,
  daily_sla,
  deliveries_completed,
  total_deliveries,
  is_own_fleet,
  finished_time,
  last_gps_update,
  gps_signal_status,
  created_at,
  updated_at
  -- Explicitly EXCLUDED: cpf, phone, cnh, cnh_category, banco, agencia, conta, tipo_conta, chave_pix, address, cnh_expiry_date, cnh_number, cnh_photo_url, vehicle_document_url, emergency_contact_name, emergency_contact_phone, user_id
FROM public.drivers;

-- Grant SELECT on view to authenticated users (view inherits RLS from drivers table)
GRANT SELECT ON public.vw_drivers_operational TO authenticated;

-- Revoke from anon
REVOKE ALL ON public.vw_drivers_operational FROM anon;