-- Fix company_vehicles tenant-aware insert/update/delete policies
-- The frontend now sends tenant_id, but we also keep a DB safety net for future inserts.

CREATE OR REPLACE FUNCTION public.enforce_company_vehicle_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_memberships
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
      NEW.tenant_id := v_tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_company_vehicle_tenant_id_trigger ON public.company_vehicles;
CREATE TRIGGER enforce_company_vehicle_tenant_id_trigger
  BEFORE INSERT OR UPDATE ON public.company_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_company_vehicle_tenant_id();

DROP POLICY IF EXISTS "Authenticated users can read vehicles" ON public.company_vehicles;
DROP POLICY IF EXISTS "Admins and fleet managers can insert vehicles" ON public.company_vehicles;
DROP POLICY IF EXISTS "Admins and fleet managers can update vehicles" ON public.company_vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON public.company_vehicles;
DROP POLICY IF EXISTS "Staff_Manage_Vehicles" ON public.company_vehicles;
DROP POLICY IF EXISTS "Staff_View_Vehicles" ON public.company_vehicles;

CREATE POLICY "Staff_View_Vehicles"
  ON public.company_vehicles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Insert_Vehicles"
  ON public.company_vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      tenant_id = public.get_user_tenant_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role::text IN ('admin', 'fleet_manager')
      )
    )
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Update_Vehicles"
  ON public.company_vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (
      tenant_id = public.get_user_tenant_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role::text IN ('admin', 'fleet_manager')
      )
    )
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    (
      tenant_id = public.get_user_tenant_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role::text IN ('admin', 'fleet_manager')
      )
    )
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Staff_Delete_Vehicles"
  ON public.company_vehicles
  FOR DELETE
  TO authenticated
  USING (
    (
      tenant_id = public.get_user_tenant_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role::text IN ('admin', 'fleet_manager')
      )
    )
    OR public.is_platform_admin(auth.uid())
  );
