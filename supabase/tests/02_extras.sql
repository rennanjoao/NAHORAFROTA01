CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  tenant_id uuid,
  document_type text,
  file_path text,
  file_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_key UNIQUE (user_id, role);
ALTER TABLE public.tenant_memberships ADD CONSTRAINT tenant_memberships_key UNIQUE (tenant_id, user_id);
ALTER TABLE public.fleet_positions ADD CONSTRAINT fleet_positions_driver_key UNIQUE (driver_id);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS document text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.manifests ALTER COLUMN manifest_code DROP NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_documents TO authenticated;
