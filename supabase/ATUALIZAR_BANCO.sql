-- ============================================================================
-- Na Hora Frota: atualizacao do banco em um arquivo so
-- ============================================================================
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
--
-- O QUE TEM AQUI
--   As migrations de supabase/migrations que podem ainda nao estar no banco,
--   na ordem certa (lista logo abaixo). As mais antigas da pasta sao do projeto
--   original e ja estao no banco; nao precisam ser rodadas de novo.
--
-- E SEGURO
--   - Roda numa transacao so: se qualquer parte falhar, nada e gravado.
--   - Pode rodar mais de uma vez: o que ja existe e mantido e os ajustes de
--     dados so completam o que ainda falta (nada e duplicado). A unica remocao
--     e o papel "viewer" sobrando em quem ja e da equipe (admin/gestor/despachante).
--   - Antes de tudo confere se o banco tem as tabelas e funcoes do projeto
--     original; se faltar algo, para com uma mensagem dizendo o que falta.
--
-- Arquivo gerado por supabase/gerar_atualizacao.sh. Nao edite a mao: altere a
-- migration e gere de novo.
--
--   20260526003000_add_tenants_plan_started_at.sql
--   20260526120000_ensure_billing_and_tenant_columns.sql
--   20260527100000_enforce_tenant_isolation.sql
--   20260527103000_plan_limits_status_rpc.sql
--   20261028120000_trial_billing_funnel_and_ops.sql
--   20261028130000_fix_driver_access_rpcs_and_realtime.sql
--   20261029120000_checkout_orders.sql
-- ============================================================================

BEGIN;

-- Conferencia: objetos do projeto original que estas migrations usam.
DO $conferencia$
DECLARE
  faltando text[] := ARRAY[]::text[];
  nome text;
BEGIN
  FOREACH nome IN ARRAY ARRAY[
    'tenants', 'tenant_memberships', 'profiles', 'user_roles', 'platform_admins', 'app_config',
    'drivers', 'company_vehicles', 'invoices', 'manifests', 'manifest_audit_logs', 'deliveries',
    'delivery_proofs', 'delivery_occurrences', 'driver_occurrences', 'driver_wallet', 'fleet_positions'
  ] LOOP
    IF to_regclass('public.' || nome) IS NULL THEN
      faltando := faltando || ('tabela ' || nome);
    END IF;
  END LOOP;

  FOREACH nome IN ARRAY ARRAY['has_role', 'is_platform_admin', 'get_user_tenant_id', 'get_plan_limits'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = nome
    ) THEN
      faltando := faltando || ('funcao ' || nome);
    END IF;
  END LOOP;

  IF to_regtype('public.app_role') IS NULL THEN
    faltando := faltando || 'tipo app_role'::text;
  END IF;

  IF cardinality(faltando) > 0 THEN
    RAISE EXCEPTION 'Este banco nao tem a base do projeto original: falta %. Nada foi alterado.',
      array_to_string(faltando, ', ')
      USING HINT = 'Confira se esta no projeto certo do Supabase. Se estiver, rode antes as migrations antigas da pasta supabase/migrations.';
  END IF;
END
$conferencia$;


-- ============================================================================
-- migrations/20260526003000_add_tenants_plan_started_at.sql
-- ============================================================================

-- Ensure tenant plan changes can store when the current plan started.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz DEFAULT now();

UPDATE public.tenants
SET plan_started_at = COALESCE(plan_started_at, created_at, now())
WHERE plan_started_at IS NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- migrations/20260526120000_ensure_billing_and_tenant_columns.sql
-- ============================================================================

-- Completa o esquema deste banco antes das regras de isolamento e do trial.
--
-- Este projeto foi montado pelo bootstrap de 27/04/2026 em cima de tabelas antigas, e
-- as migrations originais de 10/02/2026 (multi-empresa e cobrança) não rodaram aqui.
-- Faltam: tenant_id nas tabelas operacionais (entregas, comprovantes, ocorrências,
-- carteira, acerto) e as colunas de cobrança de tenants/payment_history. Sem isso a
-- atualização parava em "column tenant_id does not exist" e "contract_start_date
-- does not exist". Tudo aqui é idempotente: num banco completo, não muda nada.

-- 1) Cobrança da empresa (painel Master, bloqueio por atraso, checkout do site)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS payment_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS financial_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auto_block_days integer DEFAULT 0;

-- 2) Histórico de pagamentos no formato que o app grava
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  cycle text,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS cycle text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

CREATE INDEX IF NOT EXISTS idx_payment_history_tenant ON public.payment_history (tenant_id, payment_date DESC);
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
-- As policies vêm de 20260527100000_enforce_tenant_isolation (roda logo depois).

-- 3) tenant_id nas tabelas operacionais, preenchido a partir da tabela "pai"
--    (entrega → nota/romaneio/motorista, comprovante → nota, carteira → motorista...).
DO $ensure$
DECLARE
  tbl text;
  spec record;
  one_tenant uuid;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'drivers', 'invoices', 'manifests', 'company_vehicles', 'fleet_positions',
    'deliveries', 'delivery_proofs', 'delivery_occurrences', 'driver_occurrences',
    'driver_wallet', 'driver_activity_logs', 'manifest_audit_logs',
    'settlements', 'settlement_items', 'settlement_audit_logs'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)', tbl);
    END IF;
  END LOOP;

  -- Ordem importa: o pai precisa estar preenchido antes do filho.
  FOR spec IN
    SELECT * FROM (VALUES
      ('manifests',            'drivers',     'driver_id',     1),
      ('invoices',             'manifests',   'manifest_id',   2),
      ('fleet_positions',      'drivers',     'driver_id',     3),
      ('deliveries',           'invoices',    'invoice_id',    4),
      ('deliveries',           'manifests',   'manifest_id',   5),
      ('deliveries',           'drivers',     'driver_id',     6),
      ('delivery_proofs',      'invoices',    'invoice_id',    7),
      ('delivery_proofs',      'drivers',     'driver_id',     8),
      ('delivery_occurrences', 'invoices',    'invoice_id',    9),
      ('delivery_occurrences', 'drivers',     'driver_id',    10),
      ('driver_occurrences',   'drivers',     'driver_id',    11),
      ('driver_wallet',        'drivers',     'driver_id',    12),
      ('driver_activity_logs', 'drivers',     'driver_id',    13),
      ('manifest_audit_logs',  'manifests',   'manifest_id',  14),
      ('settlements',          'drivers',     'driver_id',    15),
      ('settlement_items',     'settlements', 'settlement_id', 16),
      ('settlement_items',     'manifests',   'manifest_id',  17),
      ('settlement_audit_logs','settlements', 'settlement_id', 18)
    ) AS v(child, parent, fk, ord)
    ORDER BY ord
  LOOP
    IF to_regclass('public.' || spec.child) IS NOT NULL
       AND to_regclass('public.' || spec.parent) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = spec.child AND column_name = spec.fk)
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = spec.parent AND column_name = 'tenant_id')
    THEN
      EXECUTE format(
        'UPDATE public.%1$I c SET tenant_id = p.tenant_id FROM public.%2$I p
          WHERE c.tenant_id IS NULL AND c.%3$I = p.id AND p.tenant_id IS NOT NULL',
        spec.child, spec.parent, spec.fk
      );
    END IF;
  END LOOP;

  -- Banco com uma única empresa: o que ainda ficou sem empresa é dela.
  IF (SELECT count(*) FROM public.tenants) = 1 THEN
    SELECT id INTO one_tenant FROM public.tenants;
    FOREACH tbl IN ARRAY ARRAY[
      'drivers', 'invoices', 'manifests', 'company_vehicles', 'fleet_positions',
      'deliveries', 'delivery_proofs', 'delivery_occurrences', 'driver_occurrences',
      'driver_wallet', 'driver_activity_logs', 'manifest_audit_logs',
      'settlements', 'settlement_items', 'settlement_audit_logs'
    ] LOOP
      IF to_regclass('public.' || tbl) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL', tbl) USING one_tenant;
      END IF;
    END LOOP;
  END IF;
END
$ensure$;


-- ============================================================================
-- migrations/20260527100000_enforce_tenant_isolation.sql
-- ============================================================================

-- Enforce tenant isolation across customer data.
-- This removes permissive authenticated policies and replaces them with
-- tenant-scoped RLS policies backed by get_user_tenant_id().

CREATE OR REPLACE FUNCTION public.is_staff_role(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
      SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY (ARRAY['admin','owner','manager','fleet_manager','dispatcher'])
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_tenant_data(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.is_staff_role(p_user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY (ARRAY['admin','owner','manager','fleet_manager','dispatcher'])
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.is_tenant_admin(p_user_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.set_current_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    v_tenant_id := public.get_user_tenant_id(auth.uid());
    IF v_tenant_id IS NOT NULL THEN
      NEW.tenant_id := v_tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_access_key_key;
DROP INDEX IF EXISTS public.invoices_access_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_access_key_unique
ON public.invoices(tenant_id, access_key);

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'drivers','fleet_positions','company_vehicles','invoices','manifests',
    'manifest_audit_logs','settlements','settlement_items','settlement_audit_logs',
    'app_config','deliveries','delivery_proofs','delivery_occurrences',
    'driver_occurrences','driver_wallet','payment_history','driver_documents'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      FOR p IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;

      EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_read_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%I" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%I" ON public.%I', t, t);

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
      ) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS set_current_tenant_id_%I ON public.%I', t, t);
        EXECUTE format(
          'CREATE TRIGGER set_current_tenant_id_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_current_tenant_id()',
          t,
          t
        );

        EXECUTE format(
          'CREATE POLICY "tenant_read_%I" ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_data(tenant_id, auth.uid()))',
          t,
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()))',
          t,
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_update_%I" ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id, auth.uid())) WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()))',
          t,
          t
        );
        EXECUTE format(
          'CREATE POLICY "tenant_delete_%I" ON public.%I FOR DELETE TO authenticated USING (public.can_manage_tenant(tenant_id, auth.uid()))',
          t,
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','tenant_memberships','profiles','user_roles','platform_admins','app_config'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      FOR p IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Tenants and memberships
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_insert_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_delete_tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "platform_manage_tenants" ON public.tenants;

CREATE POLICY "tenant_read_tenants"
ON public.tenants
FOR SELECT TO authenticated
USING (public.can_read_tenant_data(id, auth.uid()));

CREATE POLICY "tenant_update_tenants"
ON public.tenants
FOR UPDATE TO authenticated
USING (public.can_manage_tenant(id, auth.uid()))
WITH CHECK (public.can_manage_tenant(id, auth.uid()));

CREATE POLICY "platform_manage_tenants"
ON public.tenants
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "authenticated_insert_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "authenticated_update_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "authenticated_delete_tenant_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "tenant_read_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "tenant_manage_memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "platform_manage_memberships" ON public.tenant_memberships;

CREATE POLICY "tenant_read_memberships"
ON public.tenant_memberships
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "tenant_manage_memberships"
ON public.tenant_memberships
FOR ALL TO authenticated
USING (public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "platform_manage_memberships"
ON public.tenant_memberships
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Profiles and roles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_delete_profiles" ON public.profiles;
DROP POLICY IF EXISTS "tenant_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "tenant_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "tenant_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "platform_manage_profiles" ON public.profiles;

CREATE POLICY "tenant_read_profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.can_read_tenant_data(tenant_id, auth.uid()));

CREATE POLICY "tenant_insert_own_profile"
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()));

CREATE POLICY "tenant_update_own_profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "platform_manage_profiles"
ON public.profiles
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated_insert_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated_update_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "authenticated_delete_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "tenant_read_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "tenant_manage_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "platform_manage_user_roles" ON public.user_roles;

CREATE POLICY "tenant_read_user_roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "tenant_manage_user_roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()));

CREATE POLICY "platform_manage_user_roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "authenticated_insert_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "authenticated_update_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "authenticated_delete_platform_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "platform_admins_read_self" ON public.platform_admins;
DROP POLICY IF EXISTS "platform_admins_manage" ON public.platform_admins;

CREATE POLICY "platform_admins_read_self"
ON public.platform_admins
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_manage"
ON public.platform_admins
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Global non-customer settings such as the Mapbox token.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config_read_authenticated" ON public.app_config;
DROP POLICY IF EXISTS "app_config_manage_platform" ON public.app_config;

CREATE POLICY "app_config_read_authenticated"
ON public.app_config
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "app_config_manage_platform"
ON public.app_config
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Private storage buckets must not expose one tenant's files to another tenant.
UPDATE storage.buckets
SET public = false
WHERE id IN ('driver-documents', 'delivery-proofs');

DROP POLICY IF EXISTS "driver_documents_storage_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_app_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_read" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_admin_fleet_delete" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_upload" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_update" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_storage_tenant_delete" ON storage.objects;

CREATE POLICY "driver_documents_storage_tenant_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE dd.file_path = storage.objects.name
      AND (
        public.can_read_tenant_data(dd.tenant_id, auth.uid())
        OR d.user_id = auth.uid()
      )
  )
);

CREATE POLICY "driver_documents_storage_tenant_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

CREATE POLICY "driver_documents_storage_tenant_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

CREATE POLICY "driver_documents_storage_tenant_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Anyone can view delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_staff_read" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_owner_update" ON storage.objects;

CREATE POLICY "delivery_proofs_owner_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_platform_admin(auth.uid())
  )
);

CREATE POLICY "delivery_proofs_owner_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "delivery_proofs_owner_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Driver app access must be limited to the driver's own tenant and assigned records.
DROP POLICY IF EXISTS "driver_read_own_driver" ON public.drivers;
DROP POLICY IF EXISTS "driver_update_own_driver" ON public.drivers;
CREATE POLICY "driver_read_own_driver"
ON public.drivers
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()));

CREATE POLICY "driver_update_own_driver"
ON public.drivers
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.can_access_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "driver_read_own_documents" ON public.driver_documents;
CREATE POLICY "driver_read_own_documents"
ON public.driver_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = driver_documents.driver_id
      AND d.user_id = auth.uid()
      AND public.can_access_tenant(driver_documents.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "driver_read_assigned_invoices" ON public.invoices;
DROP POLICY IF EXISTS "driver_update_assigned_invoices" ON public.invoices;
CREATE POLICY "driver_read_assigned_invoices"
ON public.invoices
FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
);

CREATE POLICY "driver_update_assigned_invoices"
ON public.invoices
FOR UPDATE TO authenticated
USING (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
)
WITH CHECK (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
);

DROP POLICY IF EXISTS "driver_read_own_manifests" ON public.manifests;
CREATE POLICY "driver_read_own_manifests"
ON public.manifests
FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
  AND public.can_access_tenant(tenant_id, auth.uid())
);

-- Ensure the manifest RPC cannot attach invoices from another tenant.
CREATE OR REPLACE FUNCTION public.create_manifest_with_invoices(
  p_driver_id uuid,
  p_driver_name text,
  p_driver_cpf text DEFAULT NULL,
  p_vehicle_plate text DEFAULT NULL,
  p_vehicle_type text DEFAULT NULL,
  p_is_own_fleet boolean DEFAULT false,
  p_company_vehicle_id uuid DEFAULT NULL,
  p_freight_type text DEFAULT 'fixed',
  p_freight_value numeric DEFAULT 0,
  p_per_km_value numeric DEFAULT NULL,
  p_estimated_distance numeric DEFAULT NULL,
  p_scheduled_date date DEFAULT current_date,
  p_observation text DEFAULT NULL,
  p_invoice_ids uuid[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest_id uuid;
  v_manifest_code text;
  v_manifest_number integer;
  v_tenant_id uuid;
  v_updated_count integer := 0;
  v_requested_count integer := 0;
BEGIN
  SELECT d.tenant_id INTO v_tenant_id
  FROM public.drivers d
  WHERE d.id = p_driver_id
    AND public.can_access_tenant(d.tenant_id, auth.uid());

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Motorista nao encontrado para a empresa atual.');
  END IF;

  SELECT cardinality(COALESCE(p_invoice_ids, '{}'::uuid[])) INTO v_requested_count;

  IF v_requested_count > 0 AND EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = ANY(p_invoice_ids)
      AND i.tenant_id IS DISTINCT FROM v_tenant_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Notas fiscais de outra empresa nao podem ser vinculadas.');
  END IF;

  v_manifest_code := 'ROM-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));

  INSERT INTO public.manifests (
    tenant_id, manifest_code, driver_id, driver_name, driver_cpf, vehicle_plate, vehicle_type,
    is_own_fleet, company_vehicle_id, freight_type, freight_value, per_km_value,
    estimated_distance, scheduled_date, observation, status
  ) VALUES (
    v_tenant_id, v_manifest_code, p_driver_id, p_driver_name, p_driver_cpf, p_vehicle_plate, p_vehicle_type,
    p_is_own_fleet, p_company_vehicle_id, p_freight_type, p_freight_value, p_per_km_value,
    p_estimated_distance, p_scheduled_date, p_observation, 'pending'
  )
  RETURNING id, manifest_number INTO v_manifest_id, v_manifest_number;

  UPDATE public.invoices
  SET manifest_id = v_manifest_id,
      driver_id = p_driver_id,
      status = 'in_transit',
      updated_at = now()
  WHERE id = ANY(COALESCE(p_invoice_ids, '{}'::uuid[]))
    AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> v_requested_count THEN
    RAISE EXCEPTION 'Nem todas as notas fiscais selecionadas pertencem a empresa atual.';
  END IF;

  UPDATE public.manifests
  SET deliveries_count = v_updated_count,
      total_value = COALESCE((SELECT SUM(total_value) FROM public.invoices WHERE manifest_id = v_manifest_id AND tenant_id = v_tenant_id), 0),
      total_weight = COALESCE((SELECT SUM(total_weight) FROM public.invoices WHERE manifest_id = v_manifest_id AND tenant_id = v_tenant_id), 0)
  WHERE id = v_manifest_id
    AND tenant_id = v_tenant_id;

  UPDATE public.drivers
  SET status = 'in_route',
      updated_at = now()
  WHERE id = p_driver_id
    AND tenant_id = v_tenant_id;

  RETURN json_build_object('success', true, 'manifest_id', v_manifest_id, 'manifest_code', v_manifest_code, 'manifest_number', v_manifest_number, 'invoices_linked', v_updated_count);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================================
-- migrations/20260527103000_plan_limits_status_rpc.sql
-- ============================================================================

-- Stable plan/usage payload for tenant screens.
-- Keeps the UI from falling back to Basic when direct RLS reads are delayed or denied.

CREATE OR REPLACE FUNCTION public.get_current_plan_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_plan text;
  v_limits jsonb;
  v_system_users_count integer := 0;
  v_drivers_count integer := 0;
  v_vehicles_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'plan', 'basic',
      'limits', public.get_plan_limits('basic'),
      'system_users_count', 0,
      'drivers_count', 0,
      'vehicles_count', 0
    );
  END IF;

  SELECT public.get_user_tenant_id(v_user_id) INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'plan', 'basic',
      'limits', public.get_plan_limits('basic'),
      'system_users_count', 0,
      'drivers_count', 0,
      'vehicles_count', 0
    );
  END IF;

  SELECT COALESCE(t.plan, 'basic') INTO v_plan
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  v_plan := COALESCE(v_plan, 'basic');
  v_limits := public.get_plan_limits(v_plan);

  SELECT COUNT(DISTINCT ur.user_id) INTO v_system_users_count
  FROM public.user_roles ur
  WHERE ur.tenant_id = v_tenant_id
    AND ur.role::text = ANY (ARRAY['admin', 'dispatcher', 'fleet_manager', 'manager', 'owner']);

  SELECT COUNT(*) INTO v_drivers_count
  FROM public.drivers d
  WHERE d.tenant_id = v_tenant_id;

  SELECT COUNT(*) INTO v_vehicles_count
  FROM public.company_vehicles cv
  WHERE cv.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'plan', v_plan,
    'limits', v_limits,
    'system_users_count', COALESCE(v_system_users_count, 0),
    'drivers_count', COALESCE(v_drivers_count, 0),
    'vehicles_count', COALESCE(v_vehicles_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_plan_status() TO authenticated;


-- ============================================================================
-- migrations/20261028120000_trial_billing_funnel_and_ops.sql
-- ============================================================================

-- Trial de 7 dias, trava de trial por documento de cobranca, funil de aquisicao,
-- avisos de cobranca, chegada do motorista por raio, auto-finalizacao de romaneio
-- e endurecimento de permissoes (empresa/usuarios so admin, documentos so Super Admin).
--
-- Todas as operacoes sao idempotentes para poderem ser reaplicadas com seguranca.

-- ============================================================================
-- 1. Trial e documento de cobranca no tenant
-- ============================================================================

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_extensions integer NOT NULL DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_document text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_document_type text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS signup_visitor_id text;

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_billing_document_type_check;
ALTER TABLE public.tenants
ADD CONSTRAINT tenants_billing_document_type_check
CHECK (billing_document_type IS NULL OR billing_document_type IN ('cnpj', 'cpf'));

UPDATE public.tenants
SET billing_document = regexp_replace(cnpj, '\D', '', 'g'),
    billing_document_type = 'cnpj'
WHERE billing_document IS NULL
  AND cnpj IS NOT NULL
  AND length(regexp_replace(cnpj, '\D', '', 'g')) = 14;

-- Clientes ja ativos antes do trial existir contam como convertidos.
UPDATE public.tenants
SET converted_at = COALESCE(contract_start_date::timestamptz, created_at)
WHERE converted_at IS NULL
  AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_tenants_billing_document ON public.tenants(billing_document);
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON public.tenants(trial_ends_at) WHERE status = 'trial';

-- Registro permanente dos documentos que ja usaram o teste gratis.
-- Sobrevive a exclusao do tenant para impedir um novo trial com o mesmo CNPJ/CPF.
CREATE TABLE IF NOT EXISTS public.trial_registrations (
  document text PRIMARY KEY,
  document_type text NOT NULL CHECK (document_type IN ('cnpj', 'cpf')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trial_registrations_platform_read" ON public.trial_registrations;
CREATE POLICY "trial_registrations_platform_read"
ON public.trial_registrations
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

INSERT INTO public.trial_registrations (document, document_type, tenant_id)
SELECT DISTINCT ON (doc) doc, 'cnpj', id
FROM (
  SELECT regexp_replace(cnpj, '\D', '', 'g') AS doc, id, created_at
  FROM public.tenants
  WHERE cnpj IS NOT NULL
) existing
WHERE length(doc) = 14
ORDER BY doc, created_at
ON CONFLICT (document) DO NOTHING;

INSERT INTO public.trial_registrations (document, document_type, tenant_id)
SELECT DISTINCT ON (billing_document) billing_document, billing_document_type, id
FROM public.tenants
WHERE billing_document IS NOT NULL
  AND billing_document_type IS NOT NULL
ORDER BY billing_document, created_at
ON CONFLICT (document) DO NOTHING;

-- ============================================================================
-- 2. Estado de acesso do tenant
-- ============================================================================

-- trial | trial_expired | active | pending | blocked | none
CREATE OR REPLACE FUNCTION public.tenant_access_state(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN t.status = 'blocked' THEN 'blocked'
        WHEN t.status = 'inactive' THEN 'pending'
        WHEN t.status = 'trial' AND t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now() THEN 'trial'
        WHEN t.status = 'trial' THEN 'trial_expired'
        ELSE 'active'
      END
      FROM public.tenants t
      WHERE t.id = p_tenant_id
    ),
    'none'
  )
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.tenant_access_state(p_tenant_id) IN ('trial', 'active')
$$;

-- As funcoes de RLS passam a exigir tenant com acesso (trial vigente ou ativo).
-- Assim, quando o teste gratis termina ou a empresa e bloqueada, os dados param
-- de ser servidos pelo banco, e nao apenas escondidos na interface.
CREATE OR REPLACE FUNCTION public.can_read_tenant_data(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.is_staff_role(p_user_id)
      AND public.tenant_has_access(p_tenant_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.tenant_has_access(p_tenant_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.is_tenant_admin(p_user_id)
      AND public.tenant_has_access(p_tenant_id)
    )
$$;

-- Configuracoes da empresa e hierarquia de usuarios: somente o papel "admin".
CREATE OR REPLACE FUNCTION public.can_admin_tenant(p_tenant_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.get_user_tenant_id(p_user_id)
      AND public.has_role(p_user_id, 'admin'::public.app_role)
      AND public.tenant_has_access(p_tenant_id)
    )
$$;

GRANT EXECUTE ON FUNCTION public.tenant_access_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_tenant(uuid, uuid) TO authenticated;

-- ============================================================================
-- 3. Politicas de tenants, usuarios e perfis
-- ============================================================================

-- A equipe da empresa sempre consegue ler o proprio tenant (mesmo com trial
-- expirado), para a interface conseguir explicar o bloqueio.
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
CREATE POLICY "tenant_read_tenants"
ON public.tenants
FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (id = public.get_user_tenant_id(auth.uid()) AND public.is_staff_role(auth.uid()))
);

DROP POLICY IF EXISTS "tenant_update_tenants" ON public.tenants;
CREATE POLICY "tenant_update_tenants"
ON public.tenants
FOR UPDATE TO authenticated
USING (public.can_admin_tenant(id, auth.uid()))
WITH CHECK (public.can_admin_tenant(id, auth.uid()));

DROP POLICY IF EXISTS "tenant_manage_memberships" ON public.tenant_memberships;
CREATE POLICY "tenant_manage_memberships"
ON public.tenant_memberships
FOR ALL TO authenticated
USING (public.can_admin_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_admin_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "tenant_manage_user_roles" ON public.user_roles;
CREATE POLICY "tenant_manage_user_roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.can_admin_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_admin_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "tenant_update_own_profile" ON public.profiles;
CREATE POLICY "tenant_update_own_profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.can_admin_tenant(tenant_id, auth.uid()))
WITH CHECK (id = auth.uid() OR public.can_admin_tenant(tenant_id, auth.uid()));

-- Campos de plano/cobranca/trial so mudam pela equipe NaHora (Super Admin) ou
-- pelo servidor (service role, auth.uid() nulo). O documento de cobranca e o
-- CNPJ ficam travados para o cliente.
CREATE OR REPLACE FUNCTION public.guard_tenant_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.plan_started_at IS DISTINCT FROM OLD.plan_started_at
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.cnpj IS DISTINCT FROM OLD.cnpj
      OR NEW.billing_document IS DISTINCT FROM OLD.billing_document
      OR NEW.billing_document_type IS DISTINCT FROM OLD.billing_document_type
      OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
      OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
      OR NEW.trial_extensions IS DISTINCT FROM OLD.trial_extensions
      OR NEW.converted_at IS DISTINCT FROM OLD.converted_at
      OR NEW.next_due_date IS DISTINCT FROM OLD.next_due_date
      OR NEW.financial_status IS DISTINCT FROM OLD.financial_status
      OR NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date
      OR NEW.payment_cycle IS DISTINCT FROM OLD.payment_cycle
      OR NEW.auto_block_days IS DISTINCT FROM OLD.auto_block_days
    THEN
      RAISE EXCEPTION 'Dados de plano, cobranca e documento so podem ser alterados pela equipe NaHora Frota.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status = 'active'
    AND OLD.status IS DISTINCT FROM 'active'
    AND NEW.converted_at IS NULL
  THEN
    NEW.converted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tenant_billing_fields ON public.tenants;
CREATE TRIGGER trg_guard_tenant_billing_fields
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_billing_fields();

-- ============================================================================
-- 4. RPCs de trial
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_tenant_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant public.tenants%ROWTYPE;
  v_state text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('tenant_id', NULL, 'access_state', 'none', 'has_access', false);
  END IF;

  -- Vinculo real do usuario (sem o fallback de tenant padrao de get_user_tenant_id),
  -- para quem nao pertence a nenhuma empresa nao ver dados de cobranca de outra.
  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = COALESCE(
    (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = v_user_id LIMIT 1),
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = v_user_id LIMIT 1),
    (SELECT d.tenant_id FROM public.drivers d WHERE d.user_id = v_user_id LIMIT 1)
  );

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'access_state', 'none',
      'has_access', false,
      'is_platform_admin', public.is_platform_admin(v_user_id)
    );
  END IF;

  v_state := public.tenant_access_state(v_tenant.id);

  RETURN jsonb_build_object(
    'tenant_id', v_tenant.id,
    'razao_social', v_tenant.razao_social,
    'status', v_tenant.status,
    'plan', v_tenant.plan,
    'access_state', v_state,
    'has_access', v_state IN ('trial', 'active'),
    'trial_started_at', v_tenant.trial_started_at,
    'trial_ends_at', v_tenant.trial_ends_at,
    'trial_extensions', v_tenant.trial_extensions,
    'next_due_date', v_tenant.next_due_date,
    'financial_status', v_tenant.financial_status,
    'is_platform_admin', public.is_platform_admin(v_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.extend_tenant_trial(p_tenant_id uuid, p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_new_end timestamptz;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o Super Admin pode estender o periodo de teste.' USING ERRCODE = '42501';
  END IF;

  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'Quantidade de dias invalida (1 a 90).';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa nao encontrada.';
  END IF;

  -- Empresa bloqueada durante o teste (nunca contratou) tambem pode voltar ao teste.
  IF NOT (
    v_tenant.status IN ('trial', 'inactive')
    OR (v_tenant.status = 'blocked' AND v_tenant.converted_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'Somente empresas em teste podem ter o teste estendido (status atual: %).', v_tenant.status;
  END IF;

  v_new_end := GREATEST(COALESCE(v_tenant.trial_ends_at, now()), now()) + make_interval(days => p_days);

  UPDATE public.tenants
  SET status = 'trial',
      trial_started_at = COALESCE(trial_started_at, now()),
      trial_ends_at = v_new_end,
      trial_extensions = COALESCE(trial_extensions, 0) + 1,
      updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO public.funnel_events (visitor_id, event, tenant_id, user_id, metadata)
  VALUES (
    COALESCE(v_tenant.signup_visitor_id, 'tenant:' || p_tenant_id::text),
    'trial_extended',
    p_tenant_id,
    auth.uid(),
    jsonb_build_object('days', p_days, 'trial_ends_at', v_new_end)
  );

  RETURN jsonb_build_object('success', true, 'trial_ends_at', v_new_end);
END;
$$;

-- ============================================================================
-- 5. Funil de aquisicao (visitou -> cadastro -> testou -> converteu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  visitor_id text NOT NULL,
  event text NOT NULL,
  path text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_check;
ALTER TABLE public.funnel_events
ADD CONSTRAINT funnel_events_event_check
CHECK (event IN (
  'page_view', 'register_view', 'register_started', 'register_submitted',
  'register_completed', 'trial_extended', 'converted'
));

CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON public.funnel_events(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_visitor_event ON public.funnel_events(visitor_id, event, created_at);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "funnel_events_platform_read" ON public.funnel_events;
CREATE POLICY "funnel_events_platform_read"
ON public.funnel_events
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Insercao publica (visitantes anonimos) somente pela RPC, com validacao e
-- deduplicacao para nao virar um ponto de spam.
CREATE OR REPLACE FUNCTION public.track_funnel_event(
  p_visitor_id text,
  p_event text,
  p_path text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_visitor_id IS NULL OR p_visitor_id !~ '^[A-Za-z0-9_-]{8,64}$' THEN
    RETURN;
  END IF;

  IF p_event NOT IN ('page_view', 'register_view', 'register_started', 'register_submitted') THEN
    RETURN;
  END IF;

  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' OR pg_column_size(p_metadata) > 2048 THEN
    p_metadata := '{}'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.funnel_events fe
    WHERE fe.visitor_id = p_visitor_id
      AND fe.event = p_event
      AND fe.path IS NOT DISTINCT FROM left(p_path, 200)
      AND fe.created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.funnel_events (visitor_id, event, path, user_id, metadata)
  VALUES (p_visitor_id, p_event, left(p_path, 200), auth.uid(), p_metadata);
END;
$$;

REVOKE ALL ON FUNCTION public.track_funnel_event(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_funnel_event(text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_tenant_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.converted_at IS NOT NULL AND OLD.converted_at IS NULL THEN
    INSERT INTO public.funnel_events (visitor_id, event, tenant_id, user_id, metadata)
    VALUES (
      COALESCE(NEW.signup_visitor_id, 'tenant:' || NEW.id::text),
      'converted',
      NEW.id,
      auth.uid(),
      jsonb_build_object('previous_status', OLD.status, 'plan', NEW.plan)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_tenant_conversion ON public.tenants;
CREATE TRIGGER trg_log_tenant_conversion
AFTER UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.log_tenant_conversion();

CREATE OR REPLACE FUNCTION public.get_funnel_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao Super Admin.' USING ERRCODE = '42501';
  END IF;

  WITH events AS (
    SELECT *
    FROM public.funnel_events
    WHERE created_at >= p_from AND created_at < p_to
  ),
  signups AS (
    SELECT *
    FROM public.tenants
    WHERE created_at >= p_from AND created_at < p_to
  ),
  daily AS (
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event = 'page_view') AS visitors,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event = 'register_started') AS started
    FROM events
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'page_view'),
    'register_views', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'register_view'),
    'register_started', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'register_started'),
    'register_submitted', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'register_submitted'),
    'registered', (SELECT COUNT(*) FROM signups),
    'trial_active', (
      SELECT COUNT(*) FROM signups
      WHERE status = 'trial' AND trial_ends_at > now()
    ),
    'trial_expired_not_converted', (
      SELECT COUNT(*) FROM signups
      WHERE status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at <= now()) AND converted_at IS NULL
    ),
    'converted', (SELECT COUNT(*) FROM signups WHERE converted_at IS NOT NULL),
    'abandoned_registrations', (
      SELECT COUNT(DISTINCT e.visitor_id)
      FROM events e
      WHERE e.event = 'register_started'
        AND NOT EXISTS (
          SELECT 1 FROM public.tenants t WHERE t.signup_visitor_id = e.visitor_id
        )
    ),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM daily d), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_summary(timestamptz, timestamptz) TO authenticated;

-- ============================================================================
-- 6. Avisos de cobranca ("cobranca avisada")
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notice_type text NOT NULL CHECK (notice_type IN ('trial_ending', 'trial_expired', 'due_soon', 'due_today', 'overdue', 'manual')),
  reference_date date NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'whatsapp', 'phone')),
  shown_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_notices_in_app_unique
ON public.billing_notices(tenant_id, notice_type, reference_date)
WHERE channel = 'in_app';
CREATE INDEX IF NOT EXISTS idx_billing_notices_tenant_created ON public.billing_notices(tenant_id, created_at DESC);

ALTER TABLE public.billing_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_notices_platform_manage" ON public.billing_notices;
CREATE POLICY "billing_notices_platform_manage"
ON public.billing_notices
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Chamado pelo pop-up do cliente: registra que o aviso apareceu e, quando
-- p_acknowledged = true, que o cliente deu ciencia.
CREATE OR REPLACE FUNCTION public.record_billing_notice(
  p_notice_type text,
  p_reference_date date,
  p_acknowledged boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.get_user_tenant_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL OR NOT public.is_staff_role(auth.uid()) THEN
    RETURN;
  END IF;

  IF p_notice_type NOT IN ('trial_ending', 'trial_expired', 'due_soon', 'due_today', 'overdue') OR p_reference_date IS NULL THEN
    RAISE EXCEPTION 'Aviso de cobranca invalido.';
  END IF;

  INSERT INTO public.billing_notices (tenant_id, notice_type, reference_date, channel, user_id, acknowledged_at)
  VALUES (
    v_tenant_id,
    p_notice_type,
    p_reference_date,
    'in_app',
    auth.uid(),
    CASE WHEN p_acknowledged THEN now() END
  )
  ON CONFLICT (tenant_id, notice_type, reference_date) WHERE channel = 'in_app'
  DO UPDATE SET
    acknowledged_at = COALESCE(public.billing_notices.acknowledged_at, EXCLUDED.acknowledged_at),
    user_id = COALESCE(EXCLUDED.user_id, public.billing_notices.user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_billing_notice(text, date, boolean) TO authenticated;

-- ============================================================================
-- 7. Motoristas: e-mail de contato e chegada por raio
-- ============================================================================

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS contact_email text;
-- Ultimo envio do e-mail com os dados de acesso (limita reenvios).
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS credentials_email_sent_at timestamptz;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS arrival_distance_m numeric;

CREATE OR REPLACE FUNCTION public.distance_meters(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ))
$$;

-- Registra "motorista chegou" quando a posicao enviada pelo app esta a ate
-- p_radius_m metros do endereco da entrega. A distancia e recalculada aqui
-- para nao depender apenas do calculo feito no celular.
CREATE OR REPLACE FUNCTION public.register_driver_arrival(
  p_invoice_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m double precision DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_driver_id uuid;
  v_distance double precision;
  v_radius double precision := LEAST(GREATEST(COALESCE(p_radius_m, 100), 10), 100);
BEGIN
  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  WHERE d.user_id = auth.uid()
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('arrived', false, 'reason', 'not_a_driver');
  END IF;

  SELECT i.* INTO v_invoice
  FROM public.invoices i
  LEFT JOIN public.manifests m ON m.id = i.manifest_id
  WHERE i.id = p_invoice_id
    AND (i.driver_id = v_driver_id OR m.driver_id = v_driver_id)
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('arrived', false, 'reason', 'not_assigned');
  END IF;

  IF NOT public.tenant_has_access(v_invoice.tenant_id) THEN
    RETURN jsonb_build_object('arrived', false, 'reason', 'tenant_without_access');
  END IF;

  IF v_invoice.arrived_at IS NOT NULL THEN
    RETURN jsonb_build_object('arrived', true, 'arrived_at', v_invoice.arrived_at, 'already', true);
  END IF;

  IF v_invoice.status IN ('delivered', 'returned', 'cancelled') THEN
    RETURN jsonb_build_object('arrived', false, 'reason', 'finished');
  END IF;

  IF v_invoice.latitude IS NULL OR v_invoice.longitude IS NULL OR p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object('arrived', false, 'reason', 'no_coordinates');
  END IF;

  v_distance := public.distance_meters(p_latitude, p_longitude, v_invoice.latitude::double precision, v_invoice.longitude::double precision);

  IF v_distance > v_radius THEN
    RETURN jsonb_build_object('arrived', false, 'reason', 'too_far', 'distance_m', round(v_distance::numeric, 1));
  END IF;

  UPDATE public.invoices
  SET arrived_at = now(),
      arrival_distance_m = round(v_distance::numeric, 1)
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object('arrived', true, 'arrived_at', now(), 'distance_m', round(v_distance::numeric, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_driver_arrival(uuid, double precision, double precision, double precision) TO authenticated;

-- ============================================================================
-- 8. Romaneio finaliza sozinho quando todas as NFs foram entregues
-- ============================================================================

-- Marca o romaneio quando alguma NF dele recebe ocorrencia/devolucao enquanto
-- esta vinculada a ele (pelo app do motorista ou pelo painel). Ocorrencias de
-- roteirizacoes anteriores da mesma NF nao contam.
ALTER TABLE public.manifests ADD COLUMN IF NOT EXISTS had_occurrence boolean NOT NULL DEFAULT false;

UPDATE public.manifests m
SET had_occurrence = true
WHERE m.status NOT IN ('completed', 'paid', 'cancelled')
  AND m.had_occurrence = false
  AND (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.manifest_id = m.id AND i.status IN ('occurrence', 'returned')
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_occurrences o
      JOIN public.invoices i ON i.id = o.invoice_id
      WHERE i.manifest_id = m.id AND o.created_at >= m.created_at
    )
  );

-- Nao finaliza se houver qualquer NF nao entregue ou ocorrencia registrada
-- para as NFs do romaneio; nesses casos a finalizacao continua manual.
CREATE OR REPLACE FUNCTION public.auto_finalize_manifest_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest public.manifests%ROWTYPE;
  v_total integer;
  v_delivered integer;
  v_has_occurrence boolean;
BEGIN
  IF NEW.manifest_id IS NOT NULL
    AND NEW.status IN ('occurrence', 'returned')
    AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    UPDATE public.manifests
    SET had_occurrence = true
    WHERE id = NEW.manifest_id
      AND had_occurrence = false;
    RETURN NULL;
  END IF;

  IF NEW.manifest_id IS NULL OR NEW.status <> 'delivered' OR OLD.status IS NOT DISTINCT FROM 'delivered' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_manifest
  FROM public.manifests
  WHERE id = NEW.manifest_id
  FOR UPDATE;

  IF NOT FOUND OR v_manifest.status IN ('completed', 'paid', 'cancelled') THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'delivered')
  INTO v_total, v_delivered
  FROM public.invoices
  WHERE manifest_id = NEW.manifest_id;

  IF v_total = 0 OR v_delivered < v_total THEN
    RETURN NULL;
  END IF;

  SELECT v_manifest.had_occurrence OR EXISTS (
    SELECT 1
    FROM public.delivery_occurrences o
    JOIN public.invoices i ON i.id = o.invoice_id
    WHERE i.manifest_id = NEW.manifest_id
      AND o.created_at >= v_manifest.created_at
  )
  INTO v_has_occurrence;

  IF v_has_occurrence THEN
    RETURN NULL;
  END IF;

  UPDATE public.manifests
  SET status = 'completed',
      updated_at = now()
  WHERE id = v_manifest.id;

  IF v_manifest.driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.manifests m
    WHERE m.driver_id = v_manifest.driver_id
      AND m.id <> v_manifest.id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.drivers
    SET status = 'active',
        updated_at = now()
    WHERE id = v_manifest.driver_id
      AND status = 'in_route';
  END IF;

  IF v_manifest.company_vehicle_id IS NOT NULL THEN
    UPDATE public.company_vehicles
    SET status = 'available',
        updated_at = now()
    WHERE id = v_manifest.company_vehicle_id;
  END IF;

  INSERT INTO public.manifest_audit_logs (
    manifest_id, action_type, invoice_id, performed_by, performed_by_name,
    user_full_name, details, notes, tenant_id
  ) VALUES (
    v_manifest.id,
    'auto_finalized',
    NEW.id,
    auth.uid(),
    'Sistema',
    'Sistema',
    jsonb_build_object('delivered_count', v_delivered, 'occurrence_count', 0, 'trigger_invoice_id', NEW.id),
    'Romaneio finalizado automaticamente: todas as ' || v_delivered || ' entrega(s) concluidas sem ocorrencia',
    v_manifest.tenant_id
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_finalize_manifest_on_delivery ON public.invoices;
CREATE TRIGGER trg_auto_finalize_manifest_on_delivery
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.auto_finalize_manifest_on_delivery();

-- ============================================================================
-- 9. Documentos do motorista: arquivo so para o Super Admin
-- ============================================================================

-- A empresa continua podendo enviar e substituir arquivos (e ver que existem,
-- pela tabela driver_documents), mas abrir, baixar e apagar o arquivo fica
-- restrito. (O remove() do storage faz DELETE ... RETURNING e depende de SELECT,
-- entao apagar segue a mesma regra de abrir.)
CREATE OR REPLACE FUNCTION public.can_view_driver_documents(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin(p_user_id)
$$;

GRANT EXECUTE ON FUNCTION public.can_view_driver_documents(uuid) TO authenticated;

DROP POLICY IF EXISTS "driver_documents_storage_tenant_read" ON storage.objects;
CREATE POLICY "driver_documents_storage_tenant_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND public.can_view_driver_documents(auth.uid())
);

DROP POLICY IF EXISTS "driver_documents_storage_tenant_update" ON storage.objects;
CREATE POLICY "driver_documents_storage_tenant_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND public.can_view_driver_documents(auth.uid())
)
WITH CHECK (
  bucket_id = 'driver-documents'
  AND public.can_view_driver_documents(auth.uid())
);

-- Corrige o upload: dentro do subselect, "name" sem qualificador resolvia para
-- drivers.name (nome do motorista) e nao para o caminho do arquivo, o que negava
-- todo envio de documento feito pela empresa.
DROP POLICY IF EXISTS "driver_documents_storage_tenant_upload" ON storage.objects;
CREATE POLICY "driver_documents_storage_tenant_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "driver_documents_storage_tenant_delete" ON storage.objects;
CREATE POLICY "driver_documents_storage_tenant_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND public.can_view_driver_documents(auth.uid())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_registrations, public.funnel_events, public.billing_notices TO authenticated;

-- Funcoes internas ou so para usuarios logados: o Supabase concede EXECUTE a
-- anon por padrao no schema public. Somente track_funnel_event fica publica.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.tenant_access_state(uuid)',
    'public.tenant_has_access(uuid)',
    'public.can_admin_tenant(uuid, uuid)',
    'public.can_view_driver_documents(uuid)',
    'public.get_my_tenant_access()',
    'public.extend_tenant_trial(uuid, integer)',
    'public.get_funnel_summary(timestamptz, timestamptz)',
    'public.record_billing_notice(text, date, boolean)',
    'public.register_driver_arrival(uuid, double precision, double precision, double precision)',
    'public.guard_tenant_billing_fields()',
    'public.log_tenant_conversion()',
    'public.auto_finalize_manifest_on_delivery()'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.tenant_access_state(uuid)',
    'public.tenant_has_access(uuid)',
    'public.can_admin_tenant(uuid, uuid)',
    'public.can_view_driver_documents(uuid)',
    'public.get_my_tenant_access()',
    'public.extend_tenant_trial(uuid, integer)',
    'public.get_funnel_summary(timestamptz, timestamptz)',
    'public.record_billing_notice(text, date, boolean)',
    'public.register_driver_arrival(uuid, double precision, double precision, double precision)'
  ]
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;


-- ============================================================================
-- migrations/20261028130000_fix_driver_access_rpcs_and_realtime.sql
-- ============================================================================

-- Correcoes de problemas existentes encontrados na revisao do sistema:
-- 1. O app do motorista estava bloqueado pelo RLS (motoristas tem papel
--    "viewer", fora de is_staff_role): GPS, comprovantes, ocorrencias e carteira.
-- 2. RPCs SECURITY DEFINER sem checagem de empresa/papel (exclusoes e limpeza).
-- 3. Fotos de comprovante/ocorrencia inacessiveis para a equipe da empresa.
-- 4. Tabelas fora da publicacao do realtime (telas nao atualizavam sozinhas).
-- 5. Papel "viewer" duplicado em usuarios do painel (handle_new_user).
-- Idempotente.

-- ============================================================================
-- 1. Acesso do motorista aos proprios registros
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_driver_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.id FROM public.drivers d WHERE d.user_id = p_user_id
$$;

REVOKE EXECUTE ON FUNCTION public.current_driver_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_driver_ids(uuid) TO authenticated, service_role;

-- Posicao GPS (upsert por driver_id): ler, inserir e atualizar a propria.
DROP POLICY IF EXISTS "driver_manage_own_position" ON public.fleet_positions;
CREATE POLICY "driver_manage_own_position"
ON public.fleet_positions
FOR ALL TO authenticated
USING (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
WITH CHECK (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()));

-- Entregas (baixa): o motorista cria/atualiza a propria e le as das suas NFs.
DROP POLICY IF EXISTS "driver_manage_own_deliveries" ON public.deliveries;
CREATE POLICY "driver_manage_own_deliveries"
ON public.deliveries
FOR ALL TO authenticated
USING (
  public.can_access_tenant(tenant_id, auth.uid())
  AND (
    driver_id IN (SELECT public.current_driver_ids())
    OR invoice_id IN (
      SELECT i.id FROM public.invoices i WHERE i.driver_id IN (SELECT public.current_driver_ids())
    )
  )
)
WITH CHECK (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "driver_manage_own_delivery_proofs" ON public.delivery_proofs;
CREATE POLICY "driver_manage_own_delivery_proofs"
ON public.delivery_proofs
FOR ALL TO authenticated
USING (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
WITH CHECK (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "driver_manage_own_delivery_occurrences" ON public.delivery_occurrences;
CREATE POLICY "driver_manage_own_delivery_occurrences"
ON public.delivery_occurrences
FOR ALL TO authenticated
USING (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
WITH CHECK (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "driver_manage_own_occurrences" ON public.driver_occurrences;
CREATE POLICY "driver_manage_own_occurrences"
ON public.driver_occurrences
FOR ALL TO authenticated
USING (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
WITH CHECK (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()));

-- Carteira: somente leitura para o motorista.
DROP POLICY IF EXISTS "driver_read_own_wallet" ON public.driver_wallet;
CREATE POLICY "driver_read_own_wallet"
ON public.driver_wallet
FOR SELECT TO authenticated
USING (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()));

DO $$
BEGIN
  IF to_regclass('public.driver_activity_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "driver_manage_own_activity_logs" ON public.driver_activity_logs';
    EXECUTE $p$
      CREATE POLICY "driver_manage_own_activity_logs"
      ON public.driver_activity_logs
      FOR ALL TO authenticated
      USING (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
      WITH CHECK (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
    $p$;
  END IF;
END $$;

-- ============================================================================
-- 2. Fotos de comprovante/ocorrencia: a equipe da empresa tambem pode abrir
-- ============================================================================

-- Os arquivos ficam em <user_id do motorista>/...; antes so o proprio motorista
-- (ou o Super Admin) conseguia abrir, e o painel exibia links assinados que expiram.
DROP POLICY IF EXISTS "delivery_proofs_tenant_read" ON storage.objects;
CREATE POLICY "delivery_proofs_tenant_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id::text = (storage.foldername(storage.objects.name))[1]
      AND public.can_read_tenant_data(d.tenant_id, auth.uid())
  )
);

-- ============================================================================
-- 3. RPCs com checagem de empresa e papel
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_complete(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tenant_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sessao invalida.');
  END IF;

  IF p_user_id = v_caller THEN
    RETURN json_build_object('success', false, 'error', 'Voce nao pode remover o proprio usuario.');
  END IF;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = p_user_id
  LIMIT 1;

  IF NOT public.is_platform_admin(v_caller) THEN
    -- Login do app (sem papel de equipe): o Gestor de Frota tambem pode remover,
    -- como faz com o cadastro do motorista.
    IF v_tenant_id IS NULL OR NOT (
      public.can_admin_tenant(v_tenant_id, v_caller)
      OR (
        NOT public.is_staff_role(p_user_id)
        AND public.can_manage_tenant(v_tenant_id, v_caller)
        AND public.has_role(v_caller, 'fleet_manager'::public.app_role)
      )
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Apenas o Administrador da empresa pode remover usuarios.');
    END IF;
    IF public.is_platform_admin(p_user_id) THEN
      RETURN json_build_object('success', false, 'error', 'Usuario nao pode ser removido.');
    END IF;
  END IF;

  IF public.has_role(p_user_id, 'admin'::public.app_role) AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.tenant_memberships tm ON tm.user_id = ur.user_id
    WHERE ur.role = 'admin'
      AND tm.tenant_id = v_tenant_id
      AND ur.user_id <> p_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'A empresa precisa de pelo menos um Administrador.');
  END IF;

  DELETE FROM public.tenant_memberships WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Remove o login para o e-mail poder ser cadastrado de novo.
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_driver_complete(p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_name text;
  v_tenant_id uuid;
  v_user_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  SELECT name, tenant_id, user_id INTO v_driver_name, v_tenant_id, v_user_id
  FROM public.drivers
  WHERE id = p_driver_id;

  IF v_driver_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Motorista nao encontrado.');
  END IF;

  IF v_caller IS NOT NULL AND NOT public.is_platform_admin(v_caller) AND NOT (
    public.can_manage_tenant(v_tenant_id, v_caller)
    AND (public.has_role(v_caller, 'admin'::public.app_role) OR public.has_role(v_caller, 'fleet_manager'::public.app_role))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas Administrador ou Gestor de Frota da empresa pode remover motoristas.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.driver_id = p_driver_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Motorista com romaneio em andamento. Finalize ou cancele o romaneio antes de remover.');
  END IF;

  -- Storage files are removed by the Storage API from the frontend when needed.
  -- SQL cannot delete directly from storage.objects in hosted Supabase.
  DELETE FROM public.driver_documents WHERE driver_id = p_driver_id;
  DELETE FROM public.fleet_positions WHERE driver_id = p_driver_id;
  IF to_regclass('public.driver_activity_logs') IS NOT NULL THEN
    DELETE FROM public.driver_activity_logs WHERE driver_id = p_driver_id;
  END IF;
  DELETE FROM public.driver_wallet WHERE driver_id = p_driver_id;

  UPDATE public.company_vehicles
  SET current_driver_id = NULL,
      current_driver_name = NULL,
      status = CASE WHEN status = 'in_use' THEN 'available' ELSE status END,
      updated_at = now()
  WHERE current_driver_id = p_driver_id;

  UPDATE public.invoices SET driver_id = NULL, updated_at = now() WHERE driver_id = p_driver_id;
  UPDATE public.delivery_proofs SET driver_id = NULL WHERE driver_id = p_driver_id;
  UPDATE public.driver_occurrences SET driver_id = NULL WHERE driver_id = p_driver_id;
  UPDATE public.deliveries SET driver_id = NULL WHERE driver_id = p_driver_id;
  UPDATE public.delivery_occurrences SET driver_id = NULL WHERE driver_id = p_driver_id;
  UPDATE public.manifests SET driver_id = NULL, updated_at = now() WHERE driver_id = p_driver_id;

  DELETE FROM public.drivers WHERE id = p_driver_id;

  -- Remove tambem o login do app (somente se o usuario nao for da equipe do painel).
  IF v_user_id IS NOT NULL AND NOT public.is_staff_role(v_user_id) AND NOT public.is_platform_admin(v_user_id) THEN
    DELETE FROM public.tenant_memberships WHERE user_id = v_user_id;
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;
    BEGIN
      DELETE FROM auth.users WHERE id = v_user_id;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Motorista removido com sucesso.', 'driver_name', v_driver_name);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- "Fantasma" = motorista marcado em rota sem nenhum romaneio aberto, somente na
-- empresa de quem chama. Antes zerava motoristas em rota de todas as empresas,
-- porque total_deliveries nunca e atualizado.
CREATE OR REPLACE FUNCTION public.cleanup_ghost_drivers()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.drivers d
  SET status = 'active',
      updated_at = now()
  WHERE d.status = 'in_route'
    AND d.tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.can_manage_tenant(d.tenant_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.manifests m
      WHERE m.driver_id = d.id
        AND m.status NOT IN ('completed', 'paid', 'cancelled')
    )
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.delete_user_complete(uuid)',
    'public.delete_driver_complete(uuid)',
    'public.cleanup_ghost_drivers()'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ============================================================================
-- 4. Realtime: tabelas que as telas escutam
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOREACH t IN ARRAY ARRAY['invoices', 'manifests', 'drivers', 'fleet_positions', 'delivery_occurrences', 'driver_occurrences']
    LOOP
      IF to_regclass(format('public.%I', t)) IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ============================================================================
-- 5. Papel "viewer" sobrando em usuarios do painel
-- ============================================================================

-- handle_new_user cria "viewer" (sem empresa) para todo usuario novo; quem tambem
-- tem papel de equipe ficava com dois papeis e telas que esperam um so falhavam.
DELETE FROM public.user_roles v
WHERE v.role = 'viewer'
  AND EXISTS (
    SELECT 1 FROM public.user_roles s
    WHERE s.user_id = v.user_id
      AND s.role IN ('admin', 'fleet_manager', 'dispatcher')
  );

-- ============================================================================
-- 6. Teste gratis com acesso completo
-- ============================================================================

-- Durante o teste a empresa usa todos os recursos (relatorios, acerto, SLA), sem
-- mudar o plano contratado gravado em tenants.plan.
CREATE OR REPLACE FUNCTION public.get_current_plan_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_plan text;
  v_effective_plan text;
  v_is_trial boolean := false;
  v_system_users_count integer := 0;
  v_drivers_count integer := 0;
  v_vehicles_count integer := 0;
BEGIN
  IF v_user_id IS NOT NULL THEN
    v_tenant_id := public.get_user_tenant_id(v_user_id);
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'plan', 'basic',
      'contracted_plan', 'basic',
      'is_trial', false,
      'limits', public.get_plan_limits('basic'),
      'system_users_count', 0,
      'drivers_count', 0,
      'vehicles_count', 0
    );
  END IF;

  SELECT COALESCE(t.plan, 'basic') INTO v_plan
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  v_plan := COALESCE(v_plan, 'basic');
  v_is_trial := public.tenant_access_state(v_tenant_id) = 'trial';
  v_effective_plan := CASE WHEN v_is_trial THEN 'total' ELSE v_plan END;

  SELECT COUNT(DISTINCT ur.user_id) INTO v_system_users_count
  FROM public.user_roles ur
  WHERE ur.tenant_id = v_tenant_id
    AND ur.role::text = ANY (ARRAY['admin', 'dispatcher', 'fleet_manager', 'manager', 'owner']);

  SELECT COUNT(*) INTO v_drivers_count
  FROM public.drivers d
  WHERE d.tenant_id = v_tenant_id;

  SELECT COUNT(*) INTO v_vehicles_count
  FROM public.company_vehicles cv
  WHERE cv.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'plan', v_effective_plan,
    'contracted_plan', v_plan,
    'is_trial', v_is_trial,
    'limits', public.get_plan_limits(v_effective_plan),
    'system_users_count', COALESCE(v_system_users_count, 0),
    'drivers_count', COALESCE(v_drivers_count, 0),
    'vehicles_count', COALESCE(v_vehicles_count, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_plan_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_plan_status() TO authenticated, service_role;

-- ============================================================================
-- 7. Troca de nivel de acesso em uma unica operacao
-- ============================================================================

-- Antes o painel fazia UPDATE em user_roles: com dois papeis (viewer + admin) a
-- troca falhava pela chave unica, e o admin podia rebaixar a si mesmo ou o ultimo
-- administrador da empresa.
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role public.app_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tenant_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sessao invalida.');
  END IF;

  IF p_role::text NOT IN ('admin', 'fleet_manager', 'dispatcher') THEN
    RETURN json_build_object('success', false, 'error', 'Nivel de acesso invalido para usuario do painel.');
  END IF;

  IF p_user_id = v_caller THEN
    RETURN json_build_object('success', false, 'error', 'Voce nao pode alterar o proprio nivel de acesso.');
  END IF;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = p_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL OR NOT (public.can_admin_tenant(v_tenant_id, v_caller) OR public.is_platform_admin(v_caller)) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o Administrador da empresa pode alterar niveis de acesso.');
  END IF;

  IF p_role::text <> 'admin' AND public.has_role(p_user_id, 'admin'::public.app_role) AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.tenant_memberships tm ON tm.user_id = ur.user_id
    WHERE ur.role = 'admin'
      AND tm.tenant_id = v_tenant_id
      AND ur.user_id <> p_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'A empresa precisa de pelo menos um Administrador.');
  END IF;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (p_user_id, p_role, v_tenant_id)
  ON CONFLICT (user_id, role) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND role <> p_role;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated, service_role;

-- ============================================================================
-- 8. Textos importados do XML gravados com entidades HTML ("&amp;")
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.decode_html_entities(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(replace(replace(replace(replace(p,
    '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&apos;', ''''), '&amp;', '&')
$$;

-- Correcao de texto nao conta como alteracao da NF (updated_at e a data da ocorrencia nos relatorios).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.invoices'::regclass AND tgname = 'update_invoices_updated_at') THEN
    ALTER TABLE public.invoices DISABLE TRIGGER update_invoices_updated_at;
  END IF;
END $$;

UPDATE public.invoices
SET recipient_name = pg_temp.decode_html_entities(recipient_name),
    address_street = pg_temp.decode_html_entities(address_street),
    address_neighborhood = pg_temp.decode_html_entities(address_neighborhood),
    address_city = pg_temp.decode_html_entities(address_city),
    address_full = pg_temp.decode_html_entities(address_full)
WHERE recipient_name ~ '&(amp|lt|gt|quot|apos|#39);'
   OR address_street ~ '&(amp|lt|gt|quot|apos|#39);'
   OR address_neighborhood ~ '&(amp|lt|gt|quot|apos|#39);'
   OR address_city ~ '&(amp|lt|gt|quot|apos|#39);'
   OR address_full ~ '&(amp|lt|gt|quot|apos|#39);';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.invoices'::regclass AND tgname = 'update_invoices_updated_at') THEN
    ALTER TABLE public.invoices ENABLE TRIGGER update_invoices_updated_at;
  END IF;
END $$;

-- ============================================================================
-- 9. driver_documents com as colunas que o painel grava
-- ============================================================================

-- Bancos criados antes de 20260428103000 completa tinham a tabela sem estas
-- colunas e o envio do documento falhava (PGRST204).
DO $$
BEGIN
  IF to_regclass('public.driver_documents') IS NOT NULL THEN
    ALTER TABLE public.driver_documents
      ADD COLUMN IF NOT EXISTS mime_type text,
      ADD COLUMN IF NOT EXISTS file_size bigint,
      ADD COLUMN IF NOT EXISTS uploaded_by uuid DEFAULT auth.uid(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.driver_documents'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) = 'UNIQUE (driver_id, document_type)'
    ) THEN
      DELETE FROM public.driver_documents a
      USING public.driver_documents b
      WHERE a.driver_id = b.driver_id
        AND a.document_type = b.document_type
        AND a.created_at < b.created_at;
      ALTER TABLE public.driver_documents
        ADD CONSTRAINT driver_documents_driver_id_document_type_key UNIQUE (driver_id, document_type);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 10. Ordem das paradas calculada na roteirizacao
-- ============================================================================

-- A roteirizacao calculava a melhor sequencia, mas ela nao era gravada: o app do
-- motorista e a impressao mostravam as NFs em outra ordem.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS route_sequence integer;

CREATE OR REPLACE FUNCTION public.set_manifest_route_order(p_manifest_id uuid, p_invoice_ids uuid[])
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH ordered AS (
    SELECT t.id, t.ord::integer AS ord
    FROM unnest(p_invoice_ids) WITH ORDINALITY AS t(id, ord)
  ),
  updated AS (
    UPDATE public.invoices i
    SET route_sequence = o.ord
    FROM ordered o
    WHERE i.id = o.id
      AND i.manifest_id = p_manifest_id
    RETURNING 1
  )
  SELECT count(*)::integer FROM updated
$$;

REVOKE EXECUTE ON FUNCTION public.set_manifest_route_order(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manifest_route_order(uuid, uuid[]) TO authenticated, service_role;

-- ============================================================================
-- 11. Finalizar romaneio pelo painel em uma unica operacao, com checagens
-- ============================================================================

-- Antes o painel atualizava tudo direto e sem conferir o estado atual: podia
-- "finalizar" romaneio ja pago, deixar NFs em rota presas num romaneio fechado e
-- liberar motorista que ainda tinha outro romaneio aberto.
CREATE OR REPLACE FUNCTION public.finalize_manifest(p_manifest_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest public.manifests%ROWTYPE;
  v_open integer;
  v_delivered integer;
  v_returned integer;
BEGIN
  SELECT * INTO v_manifest
  FROM public.manifests
  WHERE id = p_manifest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Romaneio nao encontrado.');
  END IF;

  IF NOT (public.can_manage_tenant(v_manifest.tenant_id, auth.uid()) OR public.is_platform_admin(auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissao para finalizar este romaneio.');
  END IF;

  IF v_manifest.status IN ('paid', 'cancelled') THEN
    RETURN json_build_object('success', false, 'error',
      CASE WHEN v_manifest.status = 'paid' THEN 'Romaneio ja pago no acerto.' ELSE 'Romaneio cancelado.' END);
  END IF;

  IF v_manifest.status = 'completed' THEN
    RETURN json_build_object('success', true, 'already_completed', true);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('pending', 'in_transit', 'delayed', 'returning')),
    COUNT(*) FILTER (WHERE status = 'delivered')
  INTO v_open, v_delivered
  FROM public.invoices
  WHERE manifest_id = p_manifest_id;

  IF v_open > 0 THEN
    RETURN json_build_object('success', false, 'error',
      v_open || ' NF(s) ainda em rota. Registre a entrega ou a ocorrencia antes de finalizar.',
      'open_count', v_open);
  END IF;

  -- NFs com ocorrencia voltam para a roteirizacao como "Devolvido".
  WITH returned AS (
    UPDATE public.invoices
    SET status = 'returned',
        manifest_id = NULL,
        driver_id = NULL,
        route_sequence = NULL,
        updated_at = now()
    WHERE manifest_id = p_manifest_id
      AND status IN ('occurrence', 'returned')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_returned FROM returned;

  UPDATE public.manifests
  SET status = 'completed',
      had_occurrence = had_occurrence OR v_returned > 0,
      updated_at = now()
  WHERE id = p_manifest_id;

  IF v_manifest.driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.driver_id = v_manifest.driver_id
      AND m.id <> p_manifest_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.drivers
    SET status = 'active', updated_at = now()
    WHERE id = v_manifest.driver_id
      AND status = 'in_route';
  END IF;

  IF v_manifest.company_vehicle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.company_vehicle_id = v_manifest.company_vehicle_id
      AND m.id <> p_manifest_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.company_vehicles
    SET status = 'available', updated_at = now()
    WHERE id = v_manifest.company_vehicle_id;
  END IF;

  RETURN json_build_object('success', true, 'delivered_count', v_delivered, 'returned_count', v_returned);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_manifest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_manifest(uuid) TO authenticated, service_role;

-- ============================================================================
-- 12. Excluir romaneio sem desfazer entregas ja feitas
-- ============================================================================

-- Antes todas as NFs voltavam para "pendente" (inclusive as entregues) e o
-- motorista/veiculo ficavam presos como "em rota". Romaneio pago nao se exclui:
-- o pagamento precisa ser estornado no Acerto antes.
CREATE OR REPLACE FUNCTION public.delete_manifest(p_manifest_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest public.manifests%ROWTYPE;
  v_reopened integer;
  v_kept integer;
BEGIN
  SELECT * INTO v_manifest FROM public.manifests WHERE id = p_manifest_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Romaneio nao encontrado.');
  END IF;

  IF NOT (public.can_manage_tenant(v_manifest.tenant_id, auth.uid()) OR public.is_platform_admin(auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissao para excluir este romaneio.');
  END IF;

  IF v_manifest.status = 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'Romaneio pago nao pode ser excluido. Estorne o pagamento no Acerto antes.');
  END IF;

  -- NFs ainda abertas voltam para a roteirizacao.
  WITH reopened AS (
    UPDATE public.invoices
    SET status = 'pending',
        manifest_id = NULL,
        driver_id = NULL,
        route_sequence = NULL,
        updated_at = now()
    WHERE manifest_id = p_manifest_id
      AND status NOT IN ('delivered', 'returned')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_reopened FROM reopened;

  -- Entregues/devolvidas mantem status e motorista (historico e SLA).
  WITH kept AS (
    UPDATE public.invoices
    SET manifest_id = NULL,
        route_sequence = NULL,
        updated_at = now()
    WHERE manifest_id = p_manifest_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_kept FROM kept;

  DELETE FROM public.manifests WHERE id = p_manifest_id;

  IF v_manifest.driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.driver_id = v_manifest.driver_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.drivers
    SET status = 'active', updated_at = now()
    WHERE id = v_manifest.driver_id
      AND status = 'in_route';
  END IF;

  IF v_manifest.company_vehicle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.company_vehicle_id = v_manifest.company_vehicle_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.company_vehicles
    SET status = 'available', updated_at = now()
    WHERE id = v_manifest.company_vehicle_id;
  END IF;

  RETURN json_build_object('success', true, 'reopened_count', v_reopened, 'kept_count', v_kept);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_manifest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_manifest(uuid) TO authenticated, service_role;

-- ============================================================================
-- 13. Romaneio passa para "Em Rota" na primeira acao do motorista
-- ============================================================================

-- Nenhuma parte do sistema mudava o status para in_progress: o romaneio ficava
-- "Pendente" ate ser finalizado, mesmo com o motorista entregando.
CREATE OR REPLACE FUNCTION public.mark_manifest_in_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.manifest_id IS NOT NULL AND (
    (NEW.status IN ('delivered', 'occurrence', 'returned') AND OLD.status IS DISTINCT FROM NEW.status)
    OR (NEW.arrived_at IS NOT NULL AND OLD.arrived_at IS NULL)
  ) THEN
    UPDATE public.manifests
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = NEW.manifest_id
      AND status = 'pending';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_manifest_in_progress() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'arrived_at'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_mark_manifest_in_progress ON public.invoices';
    -- Nome depois de trg_auto_finalize...: se a entrega finalizar o romaneio, ele nao volta para "Em Rota".
    EXECUTE 'CREATE TRIGGER trg_mark_manifest_in_progress
      AFTER UPDATE OF status, arrived_at ON public.invoices
      FOR EACH ROW EXECUTE FUNCTION public.mark_manifest_in_progress()';
  END IF;
END $$;

-- Romaneios em andamento que ficaram como "Pendente".
UPDATE public.manifests m
SET status = 'in_progress', updated_at = now()
WHERE m.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.manifest_id = m.id
      AND (i.status IN ('delivered', 'occurrence', 'returned') OR i.arrived_at IS NOT NULL)
  );

-- ============================================================================
-- 14. Carteira do motorista: frete de cada romaneio de agregado
-- ============================================================================

-- driver_wallet nunca era gravada: a aba Carteira do app ficava vazia. Agora cada
-- romaneio de agregado tem uma linha de frete (pendente/pago acompanhando o
-- romaneio) e o Acerto grava ali os creditos/debitos avulsos.
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS type text DEFAULT 'credit';
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS manifest_id uuid REFERENCES public.manifests(id) ON DELETE SET NULL;
-- Lancamentos avulsos do Acerto (credito/debito): categoria e observacao.
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS observation text;

CREATE UNIQUE INDEX IF NOT EXISTS driver_wallet_freight_manifest_key
  ON public.driver_wallet (manifest_id)
  WHERE type = 'freight';

CREATE OR REPLACE FUNCTION public.sync_driver_wallet_freight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.driver_wallet WHERE manifest_id = OLD.id AND type = 'freight';
    RETURN OLD;
  END IF;

  IF NEW.driver_id IS NULL OR COALESCE(NEW.is_own_fleet, false) OR NEW.status = 'cancelled' THEN
    DELETE FROM public.driver_wallet WHERE manifest_id = NEW.id AND type = 'freight';
    RETURN NEW;
  END IF;

  INSERT INTO public.driver_wallet (driver_id, tenant_id, manifest_id, type, amount, description, date, status)
  VALUES (
    NEW.driver_id,
    NEW.tenant_id,
    NEW.id,
    'freight',
    COALESCE(NEW.freight_value, 0),
    'Frete do romaneio nº ' || COALESCE(NEW.manifest_number::text || '/' || to_char(NEW.created_at, 'YYYY'), NEW.manifest_code),
    COALESCE(NEW.scheduled_date::text, to_char(NEW.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')),
    CASE WHEN NEW.status = 'paid' THEN 'paid' ELSE 'pending' END
  )
  ON CONFLICT (manifest_id) WHERE type = 'freight'
  DO UPDATE SET
    driver_id = EXCLUDED.driver_id,
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    date = EXCLUDED.date,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_driver_wallet_freight() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_driver_wallet_freight ON public.manifests;
CREATE TRIGGER trg_sync_driver_wallet_freight
AFTER INSERT OR UPDATE OF status, freight_value, driver_id, is_own_fleet ON public.manifests
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_wallet_freight();

-- Antes do DELETE: depois a FK ja teria zerado o manifest_id da carteira.
DROP TRIGGER IF EXISTS trg_sync_driver_wallet_freight_delete ON public.manifests;
CREATE TRIGGER trg_sync_driver_wallet_freight_delete
BEFORE DELETE ON public.manifests
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_wallet_freight();

-- Romaneios ja existentes.
INSERT INTO public.driver_wallet (driver_id, tenant_id, manifest_id, type, amount, description, date, status)
SELECT
  m.driver_id,
  m.tenant_id,
  m.id,
  'freight',
  COALESCE(m.freight_value, 0),
  'Frete do romaneio nº ' || COALESCE(m.manifest_number::text || '/' || to_char(m.created_at, 'YYYY'), m.manifest_code),
  COALESCE(m.scheduled_date::text, to_char(m.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')),
  CASE WHEN m.status = 'paid' THEN 'paid' ELSE 'pending' END
FROM public.manifests m
WHERE m.driver_id IS NOT NULL
  AND NOT COALESCE(m.is_own_fleet, false)
  AND m.status <> 'cancelled'
ON CONFLICT (manifest_id) WHERE type = 'freight' DO NOTHING;

-- ============================================================================
-- 15. Data de conclusao do romaneio
-- ============================================================================

-- "Finalizaram hoje" usava a data de criacao: romaneio de ontem concluido hoje
-- nao aparecia. completed_at passa a ser gravado em qualquer caminho de conclusao.
ALTER TABLE public.manifests ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_manifest_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND OLD.status IS DISTINCT FROM 'paid' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status IN ('pending', 'in_progress') THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_manifest_completed_at ON public.manifests;
CREATE TRIGGER trg_stamp_manifest_completed_at
BEFORE UPDATE OF status ON public.manifests
FOR EACH ROW EXECUTE FUNCTION public.stamp_manifest_completed_at();

UPDATE public.manifests
SET completed_at = updated_at
WHERE status IN ('completed', 'paid')
  AND completed_at IS NULL;


-- ============================================================================
-- 16. Bloqueio automatico por atraso (configurado no Master)
-- ============================================================================

-- "Bloqueio automatico apos X dias de atraso (0 = desativado)" era salvo mas nunca
-- aplicado, e o painel bloqueava qualquer cliente no dia seguinte ao vencimento.
-- Agora: dentro do prazo o cliente so recebe o aviso; passado o prazo o banco para
-- de servir os dados (estado "overdue").
CREATE OR REPLACE FUNCTION public.tenant_access_state(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN t.status = 'blocked' THEN 'blocked'
        WHEN t.status = 'inactive' THEN 'pending'
        WHEN t.status = 'trial' AND t.trial_ends_at IS NOT NULL AND t.trial_ends_at > now() THEN 'trial'
        WHEN t.status = 'trial' THEN 'trial_expired'
        WHEN COALESCE(t.auto_block_days, 0) > 0
          AND t.next_due_date IS NOT NULL
          AND ((now() AT TIME ZONE 'America/Sao_Paulo')::date - t.next_due_date::date) > t.auto_block_days
          THEN 'overdue'
        ELSE 'active'
      END
      FROM public.tenants t
      WHERE t.id = p_tenant_id
    ),
    'none'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant public.tenants%ROWTYPE;
  v_state text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('tenant_id', NULL, 'access_state', 'none', 'has_access', false);
  END IF;

  -- Vinculo real do usuario (sem o fallback de tenant padrao de get_user_tenant_id),
  -- para quem nao pertence a nenhuma empresa nao ver dados de cobranca de outra.
  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = COALESCE(
    (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = v_user_id LIMIT 1),
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = v_user_id LIMIT 1),
    (SELECT d.tenant_id FROM public.drivers d WHERE d.user_id = v_user_id LIMIT 1)
  );

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'tenant_id', NULL,
      'access_state', 'none',
      'has_access', false,
      'is_platform_admin', public.is_platform_admin(v_user_id)
    );
  END IF;

  v_state := public.tenant_access_state(v_tenant.id);

  RETURN jsonb_build_object(
    'tenant_id', v_tenant.id,
    'razao_social', v_tenant.razao_social,
    'status', v_tenant.status,
    'plan', v_tenant.plan,
    'access_state', v_state,
    'has_access', v_state IN ('trial', 'active'),
    'trial_started_at', v_tenant.trial_started_at,
    'trial_ends_at', v_tenant.trial_ends_at,
    'trial_extensions', v_tenant.trial_extensions,
    'next_due_date', v_tenant.next_due_date,
    'financial_status', v_tenant.financial_status,
    'auto_block_days', v_tenant.auto_block_days,
    'is_platform_admin', public.is_platform_admin(v_user_id)
  );
END;
$$;


-- ============================================================================
-- 17. Funil: cadastro = empresa que iniciou o teste no periodo
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_funnel_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao Super Admin.' USING ERRCODE = '42501';
  END IF;

  WITH events AS (
    SELECT *
    FROM public.funnel_events
    WHERE created_at >= p_from AND created_at < p_to
  ),
  -- So empresas que iniciaram teste no periodo (antes entravam tambem as criadas
  -- pela equipe e a migracao, e "cadastraram" passava de 100%).
  signups AS (
    SELECT *
    FROM public.tenants
    WHERE trial_started_at >= p_from AND trial_started_at < p_to
  ),
  daily AS (
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event = 'page_view') AS visitors,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event = 'register_started') AS started
    FROM events
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'page_view'),
    'register_views', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'register_view'),
    'register_started', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'register_started'),
    'register_submitted', (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE event = 'register_submitted'),
    'registered', (SELECT COUNT(*) FROM signups),
    'trial_active', (
      SELECT COUNT(*) FROM signups
      WHERE status = 'trial' AND trial_ends_at > now()
    ),
    'trial_expired_not_converted', (
      SELECT COUNT(*) FROM signups
      WHERE status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at <= now()) AND converted_at IS NULL
    ),
    'converted', (SELECT COUNT(*) FROM signups WHERE converted_at IS NOT NULL),
    'abandoned_registrations', (
      SELECT COUNT(DISTINCT e.visitor_id)
      FROM events e
      WHERE e.event = 'register_started'
        AND NOT EXISTS (
          SELECT 1 FROM public.tenants t WHERE t.signup_visitor_id = e.visitor_id
        )
    ),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM daily d), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 18. Limites do plano no banco iguais aos da tela
-- ============================================================================

-- Durante o teste gratis a tela libera o plano completo (secao 6), mas os
-- gatilhos de limite olhavam tenants.plan ("basic", 1 usuario): o login era
-- criado e o papel recusado, deixando um usuario sem acesso. O gatilho de
-- usuarios tambem contava quem so estava trocando de papel, e veiculos nao
-- tinham limite no banco.
CREATE OR REPLACE FUNCTION public.tenant_effective_plan(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN public.tenant_access_state(p_tenant_id) = 'trial' THEN 'total'
    ELSE COALESCE((SELECT t.plan FROM public.tenants t WHERE t.id = p_tenant_id), 'basic')
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.tenant_effective_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_effective_plan(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_user_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_users int;
  v_current_count int;
BEGIN
  IF NEW.role::text NOT IN ('admin', 'dispatcher', 'fleet_manager') OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Quem ja e usuario do painel so esta trocando de papel.
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id
      AND ur.role::text IN ('admin', 'dispatcher', 'fleet_manager')
  ) THEN
    RETURN NEW;
  END IF;

  v_max_users := (public.get_plan_limits(public.tenant_effective_plan(NEW.tenant_id))::jsonb->>'max_users')::int;
  IF v_max_users = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT ur.user_id) INTO v_current_count
  FROM public.user_roles ur
  WHERE ur.tenant_id = NEW.tenant_id
    AND ur.role::text IN ('admin', 'dispatcher', 'fleet_manager');

  IF v_current_count >= v_max_users THEN
    RAISE EXCEPTION 'Limite de % usuário(s) do painel atingido no plano atual. Faça upgrade.', v_max_users
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_driver_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_drivers int;
  v_current_count int;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_max_drivers := (public.get_plan_limits(public.tenant_effective_plan(NEW.tenant_id))::jsonb->>'max_drivers')::int;
  IF v_max_drivers = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_current_count FROM public.drivers WHERE tenant_id = NEW.tenant_id;

  IF v_current_count >= v_max_drivers THEN
    RAISE EXCEPTION 'Limite de % motoristas atingido no plano atual. Faça upgrade.', v_max_drivers
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_vehicle_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_vehicles int;
  v_current_count int;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_max_vehicles := (public.get_plan_limits(public.tenant_effective_plan(NEW.tenant_id))::jsonb->>'max_vehicles')::int;
  IF v_max_vehicles = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_current_count FROM public.company_vehicles WHERE tenant_id = NEW.tenant_id;

  IF v_current_count >= v_max_vehicles THEN
    RAISE EXCEPTION 'Limite de % veículos atingido no plano atual. Faça upgrade.', v_max_vehicles
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_plan_limit ON public.user_roles;
CREATE TRIGGER enforce_user_plan_limit
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.check_user_plan_limit();

DROP TRIGGER IF EXISTS enforce_driver_plan_limit ON public.drivers;
CREATE TRIGGER enforce_driver_plan_limit
  BEFORE INSERT ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.check_driver_plan_limit();

DROP TRIGGER IF EXISTS enforce_vehicle_plan_limit ON public.company_vehicles;
CREATE TRIGGER enforce_vehicle_plan_limit
  BEFORE INSERT ON public.company_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.check_vehicle_plan_limit();

CREATE OR REPLACE FUNCTION public.check_plan_limit(p_tenant_id uuid, p_resource text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limits json;
  v_current_count integer;
  v_max integer;
BEGIN
  IF NOT public.can_read_tenant_data(p_tenant_id, auth.uid())
     AND NOT public.is_platform_admin(auth.uid())
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  v_limits := public.get_plan_limits(public.tenant_effective_plan(p_tenant_id));

  IF p_resource = 'users' THEN
    SELECT COUNT(DISTINCT ur.user_id) INTO v_current_count
    FROM public.user_roles ur
    WHERE ur.tenant_id = p_tenant_id
      AND ur.role::text IN ('admin', 'dispatcher', 'fleet_manager');
    v_max := (v_limits->>'max_users')::integer;
  ELSIF p_resource = 'drivers' THEN
    SELECT COUNT(*) INTO v_current_count FROM public.drivers WHERE tenant_id = p_tenant_id;
    v_max := (v_limits->>'max_drivers')::integer;
  ELSIF p_resource = 'vehicles' THEN
    SELECT COUNT(*) INTO v_current_count FROM public.company_vehicles WHERE tenant_id = p_tenant_id;
    v_max := (v_limits->>'max_vehicles')::integer;
  ELSE
    RETURN json_build_object('allowed', true);
  END IF;

  IF v_max = -1 THEN
    RETURN json_build_object('allowed', true, 'current', v_current_count, 'max', -1);
  END IF;

  RETURN json_build_object('allowed', v_current_count < v_max, 'current', v_current_count, 'max', v_max);
END;
$$;


-- ============================================================================
-- migrations/20261029120000_checkout_orders.sql
-- ============================================================================

-- Checkout self-service do site: pedidos de compra e dados da cobrança recorrente.
-- Limites por plano continuam em get_plan_limits (Básico 5/50/20 · Controle 20/200/100 · Total ilimitado).

-- 1) Pedidos (escritos só pelas Edge Functions com service role; admin da plataforma lê)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'provisioned', 'failed', 'canceled')),
  mode text NOT NULL DEFAULT 'stripe' CHECK (mode IN ('stripe', 'sandbox')),
  -- new: empresa criada na compra. conversion: empresa que já existia em teste grátis e virou assinatura.
  kind text NOT NULL DEFAULT 'new' CHECK (kind IN ('new', 'conversion')),
  existing_user boolean NOT NULL DEFAULT false,
  plan text NOT NULL CHECK (plan IN ('basic', 'control', 'total')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL',
  company_name text NOT NULL,
  cnpj text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  access_token_hash text NOT NULL,
  provider_session_id text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_event_id text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid,
  temp_password text,
  temp_password_expires_at timestamptz,
  access_email_status text NOT NULL DEFAULT 'pending' CHECK (access_email_status IN ('sent', 'pending', 'failed', 'not_configured')),
  access_sent_at timestamptz,
  paid_at timestamptz,
  provisioned_at timestamptz,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Reaplicação em banco que já tinha a tabela sem estas colunas.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'new';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS existing_user boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_cnpj ON public.orders (cnpj);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders (email);
CREATE INDEX IF NOT EXISTS idx_orders_provider_session ON public.orders (provider_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read orders" ON public.orders;
CREATE POLICY "Platform admins read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
-- Sem políticas de escrita: só o service role (Edge Functions) grava.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Empresas: dados da cobrança recorrente (Stripe)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_provider text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_customer_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_subscription_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_email text;
CREATE INDEX IF NOT EXISTS idx_tenants_billing_subscription ON public.tenants (billing_subscription_id);

NOTIFY pgrst, 'reload schema';


-- A API do Supabase passa a enxergar as funcoes novas na hora.
NOTIFY pgrst, 'reload schema';

COMMIT;
