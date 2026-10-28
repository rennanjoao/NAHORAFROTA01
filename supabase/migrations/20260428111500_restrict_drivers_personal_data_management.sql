DROP POLICY IF EXISTS "authenticated_delete_drivers" ON public.drivers;
DROP POLICY IF EXISTS "authenticated_insert_drivers" ON public.drivers;
DROP POLICY IF EXISTS "authenticated_read_drivers" ON public.drivers;
DROP POLICY IF EXISTS "authenticated_update_drivers" ON public.drivers;

CREATE POLICY "drivers_authenticated_read"
ON public.drivers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "drivers_admin_fleet_insert"
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
    AND COALESCE(tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "drivers_admin_fleet_update"
ON public.drivers
FOR UPDATE
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
    AND COALESCE(tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
    AND COALESCE(tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "drivers_admin_fleet_delete"
ON public.drivers
FOR DELETE
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role))
    AND COALESCE(tenant_id, public.get_user_tenant_id(auth.uid())) = public.get_user_tenant_id(auth.uid())
  )
);
