-- ============================================================
-- SECURITY FIX: Add explicit authentication requirement to all sensitive tables
-- This migration ensures anonymous users cannot access any sensitive data
-- ============================================================

-- 1. PROFILES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_profiles" ON public.profiles;
CREATE POLICY "deny_anonymous_profiles" 
ON public.profiles 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 2. DRIVERS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_drivers" ON public.drivers;
CREATE POLICY "deny_anonymous_drivers" 
ON public.drivers 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 3. SETTLEMENTS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_settlements" ON public.settlements;
CREATE POLICY "deny_anonymous_settlements" 
ON public.settlements 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 4. FLEET_POSITIONS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_fleet_positions" ON public.fleet_positions;
CREATE POLICY "deny_anonymous_fleet_positions" 
ON public.fleet_positions 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 5. DELIVERY_PROOFS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_delivery_proofs" ON public.delivery_proofs;
CREATE POLICY "deny_anonymous_delivery_proofs" 
ON public.delivery_proofs 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 6. INVOICES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_invoices" ON public.invoices;
CREATE POLICY "deny_anonymous_invoices" 
ON public.invoices 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 7. DELIVERIES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_deliveries" ON public.deliveries;
CREATE POLICY "deny_anonymous_deliveries" 
ON public.deliveries 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 8. MANIFESTS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_manifests" ON public.manifests;
CREATE POLICY "deny_anonymous_manifests" 
ON public.manifests 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 9. DRIVER_WALLET TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_driver_wallet" ON public.driver_wallet;
CREATE POLICY "deny_anonymous_driver_wallet" 
ON public.driver_wallet 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 10. SETTLEMENT_ITEMS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_settlement_items" ON public.settlement_items;
CREATE POLICY "deny_anonymous_settlement_items" 
ON public.settlement_items 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 11. DRIVER_ACTIVITY_LOGS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_driver_activity_logs" ON public.driver_activity_logs;
CREATE POLICY "deny_anonymous_driver_activity_logs" 
ON public.driver_activity_logs 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 12. DRIVER_OCCURRENCES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_driver_occurrences" ON public.driver_occurrences;
CREATE POLICY "deny_anonymous_driver_occurrences" 
ON public.driver_occurrences 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 13. COMPANY_VEHICLES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_company_vehicles" ON public.company_vehicles;
CREATE POLICY "deny_anonymous_company_vehicles" 
ON public.company_vehicles 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 14. OCCURRENCES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_occurrences" ON public.occurrences;
CREATE POLICY "deny_anonymous_occurrences" 
ON public.occurrences 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 15. USER_ROLES TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_user_roles" ON public.user_roles;
CREATE POLICY "deny_anonymous_user_roles" 
ON public.user_roles 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 16. SYSTEM_USERS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_system_users" ON public.system_users;
CREATE POLICY "deny_anonymous_system_users" 
ON public.system_users 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 17. MANIFEST_AUDIT_LOGS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_manifest_audit_logs" ON public.manifest_audit_logs;
CREATE POLICY "deny_anonymous_manifest_audit_logs" 
ON public.manifest_audit_logs 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 18. SETTLEMENT_AUDIT_LOGS TABLE - Add explicit authentication requirement
DROP POLICY IF EXISTS "deny_anonymous_settlement_audit_logs" ON public.settlement_audit_logs;
CREATE POLICY "deny_anonymous_settlement_audit_logs" 
ON public.settlement_audit_logs 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 19. Update vw_drivers_with_gps_status view to ensure it uses security_invoker
DROP VIEW IF EXISTS public.vw_drivers_with_gps_status;
CREATE VIEW public.vw_drivers_with_gps_status 
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  d.id,
  d.name,
  d.phone,
  d.photo_url,
  d.vehicle_plate,
  d.vehicle_type,
  d.status,
  d.gps_signal_status,
  d.last_gps_update,
  fp.latitude,
  fp.longitude,
  fp.speed,
  fp.battery_level,
  CASE 
    WHEN fp.last_update > NOW() - INTERVAL '5 minutes' AND fp.is_active = true THEN 'online'
    WHEN fp.last_update > NOW() - INTERVAL '30 minutes' THEN 'idle'
    ELSE 'offline'
  END AS computed_gps_status
FROM public.drivers d
LEFT JOIN public.fleet_positions fp ON d.id = fp.driver_id;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.vw_drivers_with_gps_status TO authenticated;
REVOKE SELECT ON public.vw_drivers_with_gps_status FROM anon;