
-- Remove leftover policies that bypass tenant isolation

-- MANIFESTS: Old policy without tenant filter
DROP POLICY IF EXISTS "Staff_View_All_Manifests" ON public.manifests;

-- DRIVERS: Service role policy should be restricted (only service_role already, but let's verify)
-- The "Service Role Manage Drivers" has roles={service_role} so it's OK for backend calls.
-- But let's also check for any other leaking policies on other tables.

-- Check and remove any other old policies on fleet_positions
DROP POLICY IF EXISTS "Service_Role_Map" ON public.fleet_positions;
DROP POLICY IF EXISTS "Service_Role_Manage_Map" ON public.fleet_positions;
