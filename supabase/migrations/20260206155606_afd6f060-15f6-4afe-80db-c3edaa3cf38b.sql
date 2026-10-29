-- ============================================================================
-- SECURITY FIX: Consolidate deliveries table RLS policies
-- ============================================================================
-- Issue: deliveries_overlapping_policies
-- - 'Driver View Assigned Deliveries' allows access when driver_id IS NULL
-- - 'Motorista ve suas entregas' uses service_role check (dangerous)
-- - Multiple overlapping policies create security confusion
-- ============================================================================

-- Step 1: Drop ALL problematic and redundant driver-related policies
DROP POLICY IF EXISTS "Driver View Assigned Deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Driver Update Own Deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Motorista ve suas entregas" ON public.deliveries;
DROP POLICY IF EXISTS "Motorista vê suas entregas" ON public.deliveries;
DROP POLICY IF EXISTS "Motoristas podem atualizar entregas" ON public.deliveries;
DROP POLICY IF EXISTS "Motoristas podem ver entregas" ON public.deliveries;
DROP POLICY IF EXISTS "Motoristas veem suas entregas" ON public.deliveries;
DROP POLICY IF EXISTS "Regra Geral Deliveries" ON public.deliveries;

-- Step 2: Keep these valid policies (just ensure they exist):
-- - deny_anonymous_deliveries (RESTRICTIVE auth requirement) ✓
-- - Admins and managers can view all deliveries ✓
-- - Admin Full Access Deliveries ✓

-- Step 3: Create clean driver policies with PROPER driver_id mapping
-- (driver_id in deliveries is NOT auth.uid(), it's drivers.id)

-- Drivers can SELECT only their explicitly assigned deliveries
CREATE POLICY "drivers_view_assigned_deliveries"
  ON public.deliveries
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- Drivers can UPDATE only their explicitly assigned deliveries
CREATE POLICY "drivers_update_assigned_deliveries"
  ON public.deliveries
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );