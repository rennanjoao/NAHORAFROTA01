
-- Add address fields to tenants table for company settings sync
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Allow tenant admins to UPDATE their own tenant record (address, phone etc)
CREATE POLICY "Tenant_Admin_Update_Own_Tenant"
  ON public.tenants
  FOR UPDATE
  USING (id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));
