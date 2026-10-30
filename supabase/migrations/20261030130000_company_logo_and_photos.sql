-- Logo da empresa (sai no romaneio impresso), foto do motorista e foto do veiculo.
-- As imagens ficam no bucket publico "tenant-media", sempre dentro da pasta da empresa:
--   {tenant_id}/logo/...  {tenant_id}/drivers/...  {tenant_id}/vehicles/...
-- Publico porque o romaneio e os avatares mostram a imagem direto (nome do arquivo
-- aleatorio, sem listagem). So a equipe da empresa envia, troca ou apaga.
-- Idempotente.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.company_vehicles ADD COLUMN IF NOT EXISTS photo_url text;
-- Veiculo do agregado (aba Veiculo do cadastro do motorista).
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_photo_url text;

-- Empresa dona da pasta (primeiro nivel do caminho); null se nao for um id.
CREATE OR REPLACE FUNCTION public.storage_tenant_id(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(p_name, '/', 1)::uuid
  END
$$;

GRANT EXECUTE ON FUNCTION public.storage_tenant_id(text) TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tenant-media', 'tenant-media', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "tenant_media_read" ON storage.objects;
DROP POLICY IF EXISTS "tenant_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant_media_update" ON storage.objects;
DROP POLICY IF EXISTS "tenant_media_delete" ON storage.objects;

-- Leitura pela API (o link publico nao passa por aqui): a propria empresa.
CREATE POLICY "tenant_media_read"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tenant-media' AND public.can_read_tenant_data(public.storage_tenant_id(name), auth.uid()));

CREATE POLICY "tenant_media_insert"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-media' AND public.can_manage_tenant(public.storage_tenant_id(name), auth.uid()));

CREATE POLICY "tenant_media_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-media' AND public.can_manage_tenant(public.storage_tenant_id(name), auth.uid()))
WITH CHECK (bucket_id = 'tenant-media' AND public.can_manage_tenant(public.storage_tenant_id(name), auth.uid()));

CREATE POLICY "tenant_media_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tenant-media' AND public.can_manage_tenant(public.storage_tenant_id(name), auth.uid()));
