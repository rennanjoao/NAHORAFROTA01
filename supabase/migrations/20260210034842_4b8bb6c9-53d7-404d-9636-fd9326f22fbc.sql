
-- =============================================================
-- TENANT ISOLATION: Security Definer functions + RLS policies
-- =============================================================

-- 1. Create a SECURITY DEFINER function to get user's tenant_id
-- This avoids infinite recursion when used in RLS policies
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_memberships
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

-- 2. Helper: check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = p_user_id
  );
$$;

-- 3. Helper: get driver's tenant_id (for driver-side RLS)
CREATE OR REPLACE FUNCTION public.get_driver_tenant_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.drivers
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

-- =============================================================
-- Fix tenant_memberships RLS (remove recursive policies)
-- =============================================================
DROP POLICY IF EXISTS "Members_View_Own" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Admin_Manage_Members" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Users can view own membership" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.tenant_memberships;

CREATE POLICY "Users_Read_Own_Membership"
  ON public.tenant_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins_Manage_Memberships"
  ON public.tenant_memberships FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- =============================================================
-- INVOICES: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_View_Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff_Insert_Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff_Update_Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff_Delete_Invoices" ON public.invoices;

CREATE POLICY "Staff_View_Invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Insert_Invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Update_Invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Delete_Invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

-- Keep driver policies but add tenant check
DROP POLICY IF EXISTS "Driver_View_Assigned_Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Driver_Update_Assigned_Invoices" ON public.invoices;

CREATE POLICY "Driver_View_Assigned_Invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    AND (tenant_id = public.get_driver_tenant_id(auth.uid()) OR tenant_id IS NULL)
  );

CREATE POLICY "Driver_Update_Assigned_Invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    AND (tenant_id = public.get_driver_tenant_id(auth.uid()) OR tenant_id IS NULL)
  );

-- =============================================================
-- MANIFESTS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_Manage_Manifests" ON public.manifests;
DROP POLICY IF EXISTS "Staff_View_Manifests" ON public.manifests;
DROP POLICY IF EXISTS "Driver_View_Own_Manifests" ON public.manifests;

CREATE POLICY "Staff_Manage_Manifests" ON public.manifests
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_View_Own_Manifests" ON public.manifests
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    AND (tenant_id = public.get_driver_tenant_id(auth.uid()) OR tenant_id IS NULL)
  );

-- =============================================================
-- DRIVERS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_Manage_Drivers" ON public.drivers;
DROP POLICY IF EXISTS "Staff_View_Drivers" ON public.drivers;
DROP POLICY IF EXISTS "Manager_View_Drivers" ON public.drivers;
DROP POLICY IF EXISTS "Driver_View_Own" ON public.drivers;

CREATE POLICY "Staff_Manage_Drivers" ON public.drivers
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_View_Drivers" ON public.drivers
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_View_Own" ON public.drivers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- DELIVERIES: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_Manage_Deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Staff_View_Deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Driver_View_Deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Driver_Finalize_Delivery" ON public.deliveries;
DROP POLICY IF EXISTS "Driver_Insert_Deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Driver_Update_Own_Delivery" ON public.deliveries;

CREATE POLICY "Admin_Manage_Deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_View_Deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_View_Deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Driver_Update_Deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Driver_Insert_Deliveries" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- FLEET_POSITIONS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_Manage_Map" ON public.fleet_positions;
DROP POLICY IF EXISTS "Driver_Update_Own_Location" ON public.fleet_positions;

CREATE POLICY "Staff_View_Fleet" ON public.fleet_positions
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Manage_Fleet" ON public.fleet_positions
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_Update_Own_Location" ON public.fleet_positions
  FOR ALL TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- COMPANY_VEHICLES: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_Manage_Vehicles" ON public.company_vehicles;
DROP POLICY IF EXISTS "Driver_View_Vehicles" ON public.company_vehicles;

CREATE POLICY "Staff_Manage_Vehicles" ON public.company_vehicles
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_View_Vehicles" ON public.company_vehicles
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- =============================================================
-- SETTLEMENTS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_Manage_Settlements" ON public.settlements;
DROP POLICY IF EXISTS "Admin_View_Settlements" ON public.settlements;
DROP POLICY IF EXISTS "Staff_View_Settlements" ON public.settlements;
DROP POLICY IF EXISTS "Driver_View_Settlements" ON public.settlements;

CREATE POLICY "Staff_Manage_Settlements" ON public.settlements
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_View_Settlements" ON public.settlements
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

-- =============================================================
-- SETTLEMENT_ITEMS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_Manage_Items" ON public.settlement_items;
DROP POLICY IF EXISTS "Staff_View_Items" ON public.settlement_items;

CREATE POLICY "Staff_Manage_Settlement_Items" ON public.settlement_items
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_View_Settlement_Items" ON public.settlement_items
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','owner','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

-- =============================================================
-- SETTLEMENT_AUDIT_LOGS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_View_Settlement_Audit" ON public.settlement_audit_logs;

CREATE POLICY "Admin_View_Settlement_Audit" ON public.settlement_audit_logs
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admin_Insert_Settlement_Audit" ON public.settlement_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

-- =============================================================
-- MANIFEST_AUDIT_LOGS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_View_Manifest_Audit" ON public.manifest_audit_logs;
DROP POLICY IF EXISTS "Staff_Create_Audit" ON public.manifest_audit_logs;

CREATE POLICY "Staff_View_Manifest_Audit" ON public.manifest_audit_logs
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Create_Manifest_Audit" ON public.manifest_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

-- =============================================================
-- DRIVER_ACTIVITY_LOGS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_View_Logs" ON public.driver_activity_logs;
DROP POLICY IF EXISTS "Driver_Create_Logs" ON public.driver_activity_logs;

CREATE POLICY "Staff_View_Activity_Logs" ON public.driver_activity_logs
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_Create_Activity_Logs" ON public.driver_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- DRIVER_WALLET: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Admin_Manage_Wallet" ON public.driver_wallet;
DROP POLICY IF EXISTS "Manager_View_Wallet" ON public.driver_wallet;
DROP POLICY IF EXISTS "Driver_View_Own_Wallet" ON public.driver_wallet;

CREATE POLICY "Admin_Manage_Wallet" ON public.driver_wallet
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_View_Wallet" ON public.driver_wallet
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','manager','fleet_manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_View_Own_Wallet" ON public.driver_wallet
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- DELIVERY_PROOFS: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_View_Proofs" ON public.delivery_proofs;
DROP POLICY IF EXISTS "Driver_Manage_Proofs" ON public.delivery_proofs;

CREATE POLICY "Staff_View_Proofs" ON public.delivery_proofs
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_Manage_Proofs" ON public.delivery_proofs
  FOR ALL TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- DELIVERY_OCCURRENCES: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_View_Occurrences" ON public.delivery_occurrences;
DROP POLICY IF EXISTS "Driver_Read_Own_Occurrences" ON public.delivery_occurrences;
DROP POLICY IF EXISTS "Driver_Create_Occurrence" ON public.delivery_occurrences;
DROP POLICY IF EXISTS "Driver_Create_Occurrences" ON public.delivery_occurrences;

CREATE POLICY "Staff_View_Delivery_Occurrences" ON public.delivery_occurrences
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_View_Own_Delivery_Occurrences" ON public.delivery_occurrences
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Driver_Create_Delivery_Occurrences" ON public.delivery_occurrences
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- DRIVER_OCCURRENCES: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_View_Occurrences" ON public.driver_occurrences;
DROP POLICY IF EXISTS "Driver_Create_Occurrence" ON public.driver_occurrences;

CREATE POLICY "Staff_View_Driver_Occurrences" ON public.driver_occurrences
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_Create_Driver_Occurrences" ON public.driver_occurrences
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- OCCURRENCES: Add tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Staff_View_All_Occurrences" ON public.occurrences;
DROP POLICY IF EXISTS "Staff_Manage_Occurrences" ON public.occurrences;
DROP POLICY IF EXISTS "Driver_View_Own_Occurrences" ON public.occurrences;
DROP POLICY IF EXISTS "Driver_Create_Occurrences" ON public.occurrences;

CREATE POLICY "Staff_Manage_Occurrences" ON public.occurrences
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = ANY(ARRAY['admin','owner','manager','fleet_manager','dispatcher'])
    ))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Driver_View_Own_Occurrences" ON public.occurrences
  FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Driver_Create_Occurrences" ON public.occurrences
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =============================================================
-- PROFILES: Add tenant isolation (keep self-access + tenant filter)
-- =============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users_View_Own_Profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Users_Update_Own_Profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users_Insert_Own_Profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- =============================================================
-- USER_ROLES: Keep existing but ensure tenant isolation
-- =============================================================
DROP POLICY IF EXISTS "Users_Read_Own_Role" ON public.user_roles;
DROP POLICY IF EXISTS "Admin_Manage_Roles" ON public.user_roles;

CREATE POLICY "Users_Read_Own_Role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Admin_Manage_Roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );
