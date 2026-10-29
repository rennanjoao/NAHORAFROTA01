
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Tenant_Admin_Manage_Members" ON public.tenant_memberships;

-- Recreate it without self-referencing subconsulta
CREATE POLICY "Tenant_Admin_Manage_Members" ON public.tenant_memberships
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND has_role(auth.uid(), 'admin'::app_role)
);
