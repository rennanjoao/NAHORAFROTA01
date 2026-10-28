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

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = public.get_user_tenant_id(v_user_id);

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

  IF v_tenant.status NOT IN ('trial', 'inactive') THEN
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

  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_occurrences o
    JOIN public.invoices i ON i.id = o.invoice_id
    WHERE i.manifest_id = NEW.manifest_id
      AND o.created_at >= v_manifest.created_at
  ) OR EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.manifest_id = NEW.manifest_id
      AND i.occurrence_type IS NOT NULL
      AND i.occurrence_type <> ''
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

-- A empresa continua podendo enviar e remover arquivos (e ver que existem, pela
-- tabela driver_documents), mas abrir/baixar o arquivo fica restrito.
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

-- Corrige upload/remocao: dentro do subselect, "name" sem qualificador resolvia
-- para drivers.name (nome do motorista) e nao para o caminho do arquivo, o que
-- negava todo envio de documento feito pela empresa.
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
  AND EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.can_manage_tenant(d.tenant_id, auth.uid())
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_registrations, public.funnel_events, public.billing_notices TO authenticated;
