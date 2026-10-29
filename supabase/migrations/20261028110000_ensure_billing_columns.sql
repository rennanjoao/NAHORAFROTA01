-- Colunas de cobrança da empresa e do histórico de pagamentos.
--
-- No projeto original elas vieram da migration 20260210040527 (Lovable). Este banco
-- foi montado pelo bootstrap de 27/04/2026, que não as criou e definiu payment_history
-- com outro formato (description/status/payment_method/paid_at). O painel Master, o
-- bloqueio por atraso (tenant_access_state) e o checkout do site precisam destas colunas.
-- Tudo aqui é IF NOT EXISTS: num banco que já as tem, não muda nada.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS payment_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS financial_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auto_block_days integer DEFAULT 0;

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

-- Banco que já tinha a tabela no formato do bootstrap: completa as colunas que o app grava.
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS cycle text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid;

CREATE INDEX IF NOT EXISTS idx_payment_history_tenant ON public.payment_history (tenant_id, payment_date DESC);

-- As policies (Super Admin e administrador da empresa) são as de
-- 20260527100000_enforce_tenant_isolation, que já cobrem payment_history.
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
