
-- =============================================
-- FASE 1: FUNDAÇÃO MULTI-TENANT
-- =============================================

-- 1. Tabela de Tenants (empresas)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive', -- inactive, active, blocked
  plan TEXT NOT NULL DEFAULT 'basic', -- basic, control, total
  plan_started_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Vínculo usuário <-> tenant
CREATE TABLE public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- admin, launcher
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- 3. Superadmins da plataforma (dono + quem ele adicionar)
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 4. Funções auxiliares
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() LIMIT 1
$$;

-- 5. Função de limites do plano
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan TEXT)
RETURNS JSON
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_plan
    WHEN 'basic' THEN '{"max_users": 1, "max_vehicles": 5, "realtime": false, "batch_import": false, "sla_weekly": false, "sla_drilldown": false, "financial_dashboard": false}'::json
    WHEN 'control' THEN '{"max_users": 5, "max_vehicles": 20, "realtime": true, "batch_import": true, "sla_weekly": true, "sla_drilldown": false, "financial_dashboard": false}'::json
    WHEN 'total' THEN '{"max_users": -1, "max_vehicles": -1, "realtime": true, "batch_import": true, "sla_weekly": true, "sla_drilldown": true, "financial_dashboard": true}'::json
    ELSE '{"max_users": 1, "max_vehicles": 5, "realtime": false, "batch_import": false, "sla_weekly": false, "sla_drilldown": false, "financial_dashboard": false}'::json
  END
$$;

-- 6. Função para checar limites
CREATE OR REPLACE FUNCTION public.check_plan_limit(p_tenant_id UUID, p_resource TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_limits JSON;
  v_current_count INTEGER;
  v_max INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  v_limits := public.get_plan_limits(v_plan);
  
  IF p_resource = 'users' THEN
    SELECT COUNT(*) INTO v_current_count FROM public.tenant_memberships WHERE tenant_id = p_tenant_id;
    v_max := (v_limits->>'max_users')::integer;
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

-- 7. Adicionar tenant_id a TODAS as tabelas existentes
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.manifests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fleet_positions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.occurrences ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.settlement_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.company_vehicles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.driver_wallet ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.driver_activity_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.driver_occurrences ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.delivery_occurrences ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.manifest_audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.settlement_audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 8. Criar tenant padrão e migrar dados existentes
DO $$
DECLARE
  v_tid UUID;
BEGIN
  INSERT INTO public.tenants (cnpj, razao_social, status, plan)
  VALUES ('00000000000000', 'Empresa Padrão (Migração)', 'active', 'total')
  RETURNING id INTO v_tid;

  UPDATE public.drivers SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.invoices SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.manifests SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.deliveries SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.fleet_positions SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.occurrences SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.settlements SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.settlement_items SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.company_vehicles SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.driver_wallet SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.driver_activity_logs SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.driver_occurrences SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.delivery_occurrences SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.delivery_proofs SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.manifest_audit_logs SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.settlement_audit_logs SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.profiles SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.system_users SET tenant_id = v_tid WHERE tenant_id IS NULL;
  UPDATE public.user_roles SET tenant_id = v_tid WHERE tenant_id IS NULL;

  -- Vincular todos os usuários existentes ao tenant padrão
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  SELECT DISTINCT v_tid, ur.user_id, 'admin'
  FROM public.user_roles ur
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
END $$;

-- 9. RLS para novas tabelas

-- Tenants
CREATE POLICY "Platform_Admin_Manage_Tenants" ON public.tenants
FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "User_View_Own_Tenant" ON public.tenants
FOR SELECT TO authenticated
USING (id = public.get_user_tenant_id());

-- Tenant memberships
CREATE POLICY "Platform_Admin_Manage_Memberships" ON public.tenant_memberships
FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "User_View_Own_Membership" ON public.tenant_memberships
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Tenant_Admin_Manage_Members" ON public.tenant_memberships
FOR ALL TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid() AND tm.tenant_id = tenant_memberships.tenant_id AND tm.role = 'admin'
  )
)
WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Platform admins
CREATE POLICY "Platform_Admin_Self_Manage" ON public.platform_admins
FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Índices para performance de tenant_id
CREATE INDEX IF NOT EXISTS idx_drivers_tenant ON public.drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manifests_tenant ON public.manifests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON public.deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fleet_positions_tenant ON public.fleet_positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_vehicles_tenant ON public.company_vehicles(tenant_id);
