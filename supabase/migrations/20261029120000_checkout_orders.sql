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
