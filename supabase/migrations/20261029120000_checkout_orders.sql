-- Checkout self-service: pedidos, cobrança por assinatura e limites por plano.

-- 1) Pedidos de compra (escritos só pelas Edge Functions com service role)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'provisioned', 'failed', 'canceled')),
  mode text NOT NULL DEFAULT 'stripe' CHECK (mode IN ('stripe', 'sandbox')),
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
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Empresas: dados da cobrança recorrente e limites do plano
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_provider text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_customer_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_subscription_id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_users integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_drivers integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_vehicles integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS document text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS name text;
CREATE INDEX IF NOT EXISTS idx_tenants_billing_subscription ON public.tenants (billing_subscription_id);

-- 3) Limites por plano alinhados aos planos vendidos (Básico 197 · Controle 370 · Controle Total 550)
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE COALESCE(p_plan, 'basic')
    WHEN 'total' THEN jsonb_build_object(
      'max_users', -1, 'max_drivers', -1, 'max_vehicles', -1,
      'realtime', true, 'batch_import', true, 'sla_weekly', true, 'sla_drilldown', true, 'financial_dashboard', true
    )
    WHEN 'control' THEN jsonb_build_object(
      'max_users', 20, 'max_drivers', 200, 'max_vehicles', 100,
      'realtime', true, 'batch_import', true, 'sla_weekly', true, 'sla_drilldown', false, 'financial_dashboard', false
    )
    ELSE jsonb_build_object(
      'max_users', 5, 'max_drivers', 50, 'max_vehicles', 20,
      'realtime', false, 'batch_import', false, 'sla_weekly', false, 'sla_drilldown', false, 'financial_dashboard', false
    )
  END
$$;

NOTIFY pgrst, 'reload schema';
