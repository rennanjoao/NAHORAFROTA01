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

-- 3) Carteira do motorista no formato que o app e o acerto gravam
--    (neste banco a tabela foi criada à mão, sem data/situação do lançamento).
ALTER TABLE IF EXISTS public.driver_wallet
  ADD COLUMN IF NOT EXISTS driver_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS route_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4) tenant_id nas tabelas operacionais, preenchido a partir da tabela "pai"
--    (entrega → nota/romaneio/motorista, comprovante → nota, carteira → motorista...).
--    Linha a linha: registro duplicado de antes do isolamento (ex.: a mesma nota
--    importada duas vezes, uma órfã) violaria a chave única por empresa; esse fica
--    sem empresa (continua invisível) em vez de derrubar a atualização inteira.
DO $ensure$
DECLARE
  tbl text;
  spec record;
  r record;
  one_tenant uuid;
  skipped integer := 0;
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
      FOR r IN EXECUTE format(
        'SELECT c.ctid AS rid, p.tenant_id AS tid FROM public.%1$I c JOIN public.%2$I p ON c.%3$I = p.id
          WHERE c.tenant_id IS NULL AND p.tenant_id IS NOT NULL',
        spec.child, spec.parent, spec.fk
      ) LOOP
        BEGIN
          EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE ctid = $2', spec.child) USING r.tid, r.rid;
        EXCEPTION WHEN unique_violation THEN
          skipped := skipped + 1;
        END;
      END LOOP;
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
        FOR r IN EXECUTE format('SELECT ctid AS rid FROM public.%I WHERE tenant_id IS NULL', tbl) LOOP
          BEGIN
            EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE ctid = $2', tbl) USING one_tenant, r.rid;
          EXCEPTION WHEN unique_violation THEN
            skipped := skipped + 1;
          END;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  IF skipped > 0 THEN
    RAISE NOTICE 'ensure_billing_and_tenant_columns: % registro(s) duplicado(s) ficaram sem empresa (invisíveis).', skipped;
  END IF;
END
$ensure$;
