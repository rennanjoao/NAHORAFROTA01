-- Transportadoras e pagamento mediante nota fiscal.
--
-- 1. Empresa responde "so paga mediante nota fiscal?" (tenants.pays_only_with_invoice;
--    null = ainda nao respondeu). Com "sim", romaneio do agregado TAC so vai para pago
--    com a nota fiscal aprovada. A regra nao vale para transportadora nem para motorista
--    da casa.
-- 2. Transportadoras (carriers): dados cadastrais, inscricao estadual e dados bancarios/Pix.
--    O motorista pode ser de uma transportadora (drivers.carrier_id); o acerto dele e
--    feito com a transportadora, sem nota no app.
-- 3. Notas fiscais do agregado TAC (provider_invoices): ele escolhe os dias que
--    trabalhou, emite a nota fora do app e anexa. A equipe aprova ou recusa. Enquanto nao
--    aprovada (e nao paga), quem enviou pode editar; depois de aprovada, so o
--    administrador. Paga, ninguem edita (estorna antes).
-- Idempotente.

-- ============================================================================
-- 1. Empresa: so paga mediante nota fiscal?
-- ============================================================================
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pays_only_with_invoice boolean;

-- ============================================================================
-- 2. Transportadoras
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text NOT NULL,
  inscricao_estadual text,
  ie_isento boolean NOT NULL DEFAULT false,
  telefone text,
  email text,
  cidade text,
  uf text,
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  chave_pix text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carriers_cnpj_digits CHECK (cnpj ~ '^[0-9]{14}$'),
  CONSTRAINT carriers_razao_social_length CHECK (char_length(btrim(razao_social)) >= 2)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carriers_tenant_cnpj_key') THEN
    ALTER TABLE public.carriers ADD CONSTRAINT carriers_tenant_cnpj_key UNIQUE (tenant_id, cnpj);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_carriers_tenant ON public.carriers(tenant_id);
-- Tabela criada antes (sem os padroes desta migration): transportadora nova nasce ativa.
ALTER TABLE public.carriers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.carriers ALTER COLUMN active SET DEFAULT true;
ALTER TABLE public.carriers ALTER COLUMN ie_isento SET DEFAULT false;
ALTER TABLE public.carriers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.carriers ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carriers_read" ON public.carriers;
CREATE POLICY "carriers_read"
ON public.carriers
FOR SELECT TO authenticated
USING (public.can_read_tenant_data(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "carriers_manage" ON public.carriers;
CREATE POLICY "carriers_manage"
ON public.carriers
FOR ALL TO authenticated
USING (public.can_manage_tenant(tenant_id, auth.uid()))
WITH CHECK (public.can_manage_tenant(tenant_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carriers TO authenticated;

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES public.carriers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_carrier ON public.drivers(carrier_id) WHERE carrier_id IS NOT NULL;

-- Transportadora de outra empresa nao entra no cadastro; o motorista nao troca a propria.
CREATE OR REPLACE FUNCTION public.guard_driver_carrier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.carrier_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.carrier_id IS NOT DISTINCT FROM OLD.carrier_id THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.carrier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.carriers c WHERE c.id = NEW.carrier_id AND c.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Transportadora não encontrada nesta empresa.' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_tenant(NEW.tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Só a equipe da empresa liga o motorista a uma transportadora.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_carrier ON public.drivers;
CREATE TRIGGER trg_guard_driver_carrier
BEFORE INSERT OR UPDATE OF carrier_id ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_carrier();

-- ============================================================================
-- 3. Notas fiscais do agregado TAC (provider_invoices)
--    So o agregado que recebe direto: motorista da casa nao tem frete e o de
--    transportadora recebe pela transportadora, sem nota no app.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.provider_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  work_dates date[] NOT NULL,
  invoice_number text NOT NULL,
  issue_date date,
  amount numeric(12,2) NOT NULL,
  expected_amount numeric(12,2) NOT NULL DEFAULT 0,
  file_path text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  paid_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_invoices_status CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  CONSTRAINT provider_invoices_amount CHECK (amount > 0),
  CONSTRAINT provider_invoices_days CHECK (cardinality(work_dates) > 0)
);

ALTER TABLE public.provider_invoices ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.provider_invoices ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.provider_invoices ALTER COLUMN expected_amount SET DEFAULT 0;
ALTER TABLE public.provider_invoices ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.provider_invoices ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_provider_invoices_tenant ON public.provider_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_driver ON public.provider_invoices(driver_id);

ALTER TABLE public.manifests ADD COLUMN IF NOT EXISTS provider_invoice_id uuid REFERENCES public.provider_invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_manifests_provider_invoice ON public.manifests(provider_invoice_id) WHERE provider_invoice_id IS NOT NULL;

ALTER TABLE public.provider_invoices ENABLE ROW LEVEL SECURITY;

-- Le: equipe da empresa e o motorista dono da nota. Grava: so pelas funcoes abaixo.
DROP POLICY IF EXISTS "provider_invoices_read" ON public.provider_invoices;
CREATE POLICY "provider_invoices_read"
ON public.provider_invoices
FOR SELECT TO authenticated
USING (
  public.can_read_tenant_data(tenant_id, auth.uid())
  OR (driver_id IN (SELECT public.current_driver_ids()) AND public.can_access_tenant(tenant_id, auth.uid()))
);

REVOKE INSERT, UPDATE, DELETE ON public.provider_invoices FROM authenticated, anon;
GRANT SELECT ON public.provider_invoices TO authenticated;

-- Dia do romaneio (horario de Brasilia).
CREATE OR REPLACE FUNCTION public.manifest_work_date(p_created_at timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_created_at AT TIME ZONE 'America/Sao_Paulo')::date
$$;

-- Agregado que recebe direto (TAC): nao e da casa nem de transportadora.
CREATE OR REPLACE FUNCTION public.is_tac_driver(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = p_driver_id AND NOT COALESCE(d.is_own_fleet, false) AND d.carrier_id IS NULL
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_tac_driver(uuid) FROM PUBLIC, anon, authenticated;

-- Romaneios de agregado do motorista (os que a nota dele pode cobrir).
CREATE OR REPLACE FUNCTION public.tac_manifests(p_driver_id uuid)
RETURNS SETOF public.manifests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.*
  FROM public.manifests m
  JOIN public.drivers d ON d.id = m.driver_id AND d.tenant_id = m.tenant_id
  WHERE m.driver_id = p_driver_id
    AND NOT COALESCE(m.is_own_fleet, false)
    AND m.status <> 'cancelled'
$$;

REVOKE EXECUTE ON FUNCTION public.tac_manifests(uuid) FROM PUBLIC, anon, authenticated;

-- Dias com romaneio no periodo, para escolher os dias trabalhados:
-- quantos romaneios, quantos finalizados e sem pagamento, quantos ja pagos, o frete a
-- receber e se o dia ja esta em outra nota (p_invoice_id = a nota sendo editada, cujos
-- dias ficam livres).
CREATE OR REPLACE FUNCTION public.provider_invoice_days(
  p_driver_id uuid,
  p_from date,
  p_to date,
  p_invoice_id uuid DEFAULT NULL
)
RETURNS TABLE (work_date date, manifests integer, payable integer, paid integer, freight numeric, other_invoice text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid := (SELECT d.tenant_id FROM public.drivers d WHERE d.id = p_driver_id);
BEGIN
  IF v_tenant IS NULL OR NOT (
    public.can_read_tenant_data(v_tenant, auth.uid())
    OR p_driver_id IN (SELECT public.current_driver_ids())
  ) THEN
    RAISE EXCEPTION 'Sem acesso a estes romaneios.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to - p_from > 92 THEN
    RAISE EXCEPTION 'Escolha um período de até 3 meses.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH m AS (
    SELECT tm.*, public.manifest_work_date(tm.created_at) AS day
    FROM public.tac_manifests(p_driver_id) tm
    WHERE public.manifest_work_date(tm.created_at) BETWEEN p_from AND p_to
  )
  SELECT
    m.day,
    count(*)::integer,
    count(*) FILTER (WHERE m.status = 'completed' AND (m.provider_invoice_id IS NULL OR m.provider_invoice_id = p_invoice_id))::integer,
    count(*) FILTER (WHERE m.status = 'paid')::integer,
    COALESCE(sum(m.freight_value) FILTER (WHERE m.status = 'completed' AND (m.provider_invoice_id IS NULL OR m.provider_invoice_id = p_invoice_id)), 0),
    (SELECT pi.invoice_number FROM public.provider_invoices pi
      WHERE pi.driver_id = p_driver_id
        AND pi.id IS DISTINCT FROM p_invoice_id
        AND pi.status <> 'rejected'
        AND m.day = ANY (pi.work_dates)
      LIMIT 1)
  FROM m
  GROUP BY m.day
  ORDER BY m.day;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.provider_invoice_days(uuid, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_invoice_days(uuid, date, date, uuid) TO authenticated;

-- Liga a nota aos romaneios finalizados e sem pagamento dos dias escolhidos e
-- recalcula o valor esperado (soma do frete).
CREATE OR REPLACE FUNCTION public.relink_provider_invoice(p_invoice_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.provider_invoices;
  v_total numeric;
BEGIN
  SELECT * INTO v FROM public.provider_invoices WHERE id = p_invoice_id;
  UPDATE public.manifests SET provider_invoice_id = NULL
  WHERE provider_invoice_id = p_invoice_id AND status <> 'paid';
  IF v.status IN ('pending', 'approved') THEN
    UPDATE public.manifests SET provider_invoice_id = p_invoice_id
    WHERE id IN (
      SELECT tm.id FROM public.tac_manifests(v.driver_id) tm
      WHERE tm.status = 'completed'
        AND tm.provider_invoice_id IS NULL
        AND public.manifest_work_date(tm.created_at) = ANY (v.work_dates)
    );
  END IF;
  SELECT COALESCE(sum(freight_value), 0) INTO v_total FROM public.manifests WHERE provider_invoice_id = p_invoice_id;
  UPDATE public.provider_invoices SET expected_amount = v_total WHERE id = p_invoice_id;
  RETURN v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.relink_provider_invoice(uuid) FROM PUBLIC, anon, authenticated;

-- Envia ou edita a nota do agregado TAC (ele mesmo ou a equipe). Devolve o id.
CREATE OR REPLACE FUNCTION public.submit_provider_invoice(
  p_id uuid,
  p_driver_id uuid,
  p_work_dates date[],
  p_invoice_number text,
  p_issue_date date,
  p_amount numeric,
  p_file_path text,
  p_file_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid := (SELECT d.tenant_id FROM public.drivers d WHERE d.id = p_driver_id);
  v_own boolean := p_driver_id IN (SELECT public.current_driver_ids());
  v_staff boolean;
  v_admin boolean;
  v_old public.provider_invoices;
  v_dates date[];
  v_clash text;
  v_id uuid;
  v_status text := 'pending';
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado.' USING ERRCODE = 'no_data_found';
  END IF;
  v_staff := public.can_manage_tenant(v_tenant, auth.uid());
  v_admin := public.can_admin_tenant(v_tenant, auth.uid());
  IF NOT (v_own OR v_staff) THEN
    RAISE EXCEPTION 'Sem permissão para enviar esta nota.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_tac_driver(p_driver_id) THEN
    RAISE EXCEPTION 'Nota fiscal só para agregado que recebe direto. Motorista da casa ou de transportadora não envia nota.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT array_agg(DISTINCT d ORDER BY d) INTO v_dates FROM unnest(p_work_dates) AS d WHERE d IS NOT NULL;
  IF v_dates IS NULL THEN
    RAISE EXCEPTION 'Escolha os dias que trabalhou.' USING ERRCODE = 'check_violation';
  END IF;
  IF btrim(COALESCE(p_invoice_number, '')) = '' THEN
    RAISE EXCEPTION 'Informe o número da nota fiscal.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe o valor da nota fiscal.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(p_file_path, '') NOT LIKE v_tenant::text || '/%' THEN
    RAISE EXCEPTION 'Anexe o arquivo da nota fiscal.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.provider_invoices WHERE id = p_id FOR UPDATE;
    IF v_old.id IS NULL OR v_old.tenant_id <> v_tenant OR v_old.driver_id <> p_driver_id THEN
      RAISE EXCEPTION 'Nota fiscal não encontrada.' USING ERRCODE = 'no_data_found';
    END IF;
    IF v_old.status = 'paid' THEN
      RAISE EXCEPTION 'Esta nota já foi paga. Para mudar, estorne o pagamento antes.' USING ERRCODE = 'check_violation';
    END IF;
    IF v_old.status = 'approved' AND NOT v_admin THEN
      RAISE EXCEPTION 'Nota já aprovada: só o administrador da empresa pode editar.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- Edicao do administrador mantem a aprovacao; reenvio volta para aprovacao.
    IF v_old.status = 'approved' THEN v_status := 'approved'; END IF;
  END IF;

  SELECT pi.invoice_number INTO v_clash
  FROM public.provider_invoices pi
  WHERE pi.driver_id = p_driver_id
    AND pi.id IS DISTINCT FROM p_id
    AND pi.status <> 'rejected'
    AND pi.work_dates && v_dates
  LIMIT 1;
  IF v_clash IS NOT NULL THEN
    RAISE EXCEPTION 'Algum desses dias já está na nota %. Tire o dia repetido.', v_clash USING ERRCODE = 'unique_violation';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.provider_invoices (tenant_id, driver_id, work_dates, invoice_number, issue_date, amount, file_path, file_name, status, submitted_by)
    VALUES (v_tenant, p_driver_id, v_dates, btrim(p_invoice_number), p_issue_date, round(p_amount, 2), p_file_path, p_file_name, 'pending', auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.provider_invoices SET
      work_dates = v_dates,
      invoice_number = btrim(p_invoice_number),
      issue_date = p_issue_date,
      amount = round(p_amount, 2),
      file_path = p_file_path,
      file_name = p_file_name,
      status = v_status,
      review_note = CASE WHEN v_status = 'pending' THEN NULL ELSE review_note END,
      reviewed_by = CASE WHEN v_status = 'pending' THEN NULL ELSE reviewed_by END,
      reviewed_at = CASE WHEN v_status = 'pending' THEN NULL ELSE reviewed_at END,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.relink_provider_invoice(v_id);
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_provider_invoice(uuid, uuid, date[], text, date, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_provider_invoice(uuid, uuid, date[], text, date, numeric, text, text) TO authenticated;

-- Aprova ou recusa (quem faz o acerto: equipe da empresa).
CREATE OR REPLACE FUNCTION public.review_provider_invoice(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.provider_invoices;
BEGIN
  SELECT * INTO v FROM public.provider_invoices WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL OR NOT public.can_manage_tenant(v.tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Nota fiscal não encontrada.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta nota não está aguardando aprovação.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT p_approve AND btrim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Escreva o motivo da recusa para o motorista corrigir.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.provider_invoices SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_id;
  PERFORM public.relink_provider_invoice(p_id);
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_provider_invoice(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_provider_invoice(uuid, boolean, text) TO authenticated;

-- Exclui: quem pode editar a nota pode excluir (paga, nunca).
CREATE OR REPLACE FUNCTION public.delete_provider_invoice(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.provider_invoices;
  v_own boolean;
BEGIN
  SELECT * INTO v FROM public.provider_invoices WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Nota fiscal não encontrada.' USING ERRCODE = 'no_data_found';
  END IF;
  v_own := v.driver_id IN (SELECT public.current_driver_ids());
  IF v.status = 'paid' THEN
    RAISE EXCEPTION 'Esta nota já foi paga e não pode ser excluída.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (
    (v.status IN ('pending', 'rejected') AND (v_own OR public.can_manage_tenant(v.tenant_id, auth.uid())))
    OR public.can_admin_tenant(v.tenant_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Nota já aprovada: só o administrador da empresa pode excluir.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.manifests SET provider_invoice_id = NULL WHERE provider_invoice_id = p_id;
  DELETE FROM public.provider_invoices WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_provider_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_provider_invoice(uuid) TO authenticated;

-- Pagamento: com "so paga mediante nota fiscal", romaneio do agregado TAC so vai para
-- pago com a nota aprovada (transportadora e motorista da casa nao entram na regra).
-- Quando todos os romaneios da nota estao pagos, a nota fica paga; estorno volta a nota
-- para aprovada.
CREATE OR REPLACE FUNCTION public.enforce_invoice_before_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid'
    AND NOT COALESCE(NEW.is_own_fleet, false)
    AND public.is_tac_driver(NEW.driver_id)
    AND COALESCE((SELECT t.pays_only_with_invoice FROM public.tenants t WHERE t.id = NEW.tenant_id), false)
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_invoices pi
      WHERE pi.id = NEW.provider_invoice_id AND pi.status IN ('approved', 'paid')
    ) THEN
    RAISE EXCEPTION 'Este romaneio só pode ser pago com a nota fiscal aprovada.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_before_payment ON public.manifests;
CREATE TRIGGER trg_enforce_invoice_before_payment
BEFORE UPDATE OF status ON public.manifests
FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_before_payment();

CREATE OR REPLACE FUNCTION public.sync_provider_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.provider_invoice_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'paid' AND NOT EXISTS (
    SELECT 1 FROM public.manifests m WHERE m.provider_invoice_id = NEW.provider_invoice_id AND m.status <> 'paid'
  ) THEN
    UPDATE public.provider_invoices SET status = 'paid', paid_at = now(), updated_at = now()
    WHERE id = NEW.provider_invoice_id AND status = 'approved';
  ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    UPDATE public.provider_invoices SET status = 'approved', paid_at = NULL, updated_at = now()
    WHERE id = NEW.provider_invoice_id AND status = 'paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_provider_invoice_paid ON public.manifests;
CREATE TRIGGER trg_sync_provider_invoice_paid
AFTER UPDATE OF status ON public.manifests
FOR EACH ROW EXECUTE FUNCTION public.sync_provider_invoice_paid();

-- Romaneio finalizado depois do envio da nota: entra na nota que ja cobre aquele dia.
CREATE OR REPLACE FUNCTION public.link_completed_manifest_to_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice uuid;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed'
    OR NEW.provider_invoice_id IS NOT NULL OR COALESCE(NEW.is_own_fleet, false)
    OR NOT public.is_tac_driver(NEW.driver_id) THEN
    RETURN NEW;
  END IF;
  SELECT pi.id INTO v_invoice
  FROM public.provider_invoices pi
  WHERE pi.driver_id = NEW.driver_id
    AND pi.tenant_id = NEW.tenant_id
    AND pi.status IN ('pending', 'approved')
    AND public.manifest_work_date(NEW.created_at) = ANY (pi.work_dates)
  ORDER BY pi.created_at
  LIMIT 1;
  IF v_invoice IS NOT NULL THEN
    UPDATE public.manifests SET provider_invoice_id = v_invoice WHERE id = NEW.id;
    UPDATE public.provider_invoices
    SET expected_amount = (SELECT COALESCE(sum(m.freight_value), 0) FROM public.manifests m WHERE m.provider_invoice_id = v_invoice)
    WHERE id = v_invoice;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_completed_manifest_to_invoice ON public.manifests;
CREATE TRIGGER trg_link_completed_manifest_to_invoice
AFTER UPDATE OF status ON public.manifests
FOR EACH ROW EXECUTE FUNCTION public.link_completed_manifest_to_invoice();

-- App do motorista: como ele recebe (sem dar acesso a tabela de empresas/transportadoras).
CREATE OR REPLACE FUNCTION public.get_my_payment_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'driver_id', d.id,
    'tenant_id', d.tenant_id,
    'is_own_fleet', COALESCE(d.is_own_fleet, false),
    'pays_only_with_invoice', COALESCE(t.pays_only_with_invoice, false),
    'carrier_name', COALESCE(c.nome_fantasia, c.razao_social)
  )
  FROM public.drivers d
  JOIN public.tenants t ON t.id = d.tenant_id
  LEFT JOIN public.carriers c ON c.id = d.carrier_id
  WHERE d.user_id = auth.uid()
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_payment_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payment_profile() TO authenticated;

-- ============================================================================
-- 4. Arquivos das notas: bucket privado, pasta da empresa e do motorista
--    {tenant_id}/{driver_id}/...
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('provider-invoices', 'provider-invoices', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "provider_invoices_files_read" ON storage.objects;
DROP POLICY IF EXISTS "provider_invoices_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "provider_invoices_files_delete" ON storage.objects;

CREATE POLICY "provider_invoices_files_read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'provider-invoices' AND (
    public.can_read_tenant_data(public.storage_tenant_id(name), auth.uid())
    OR split_part(name, '/', 2) IN (SELECT id::text FROM public.current_driver_ids() AS id)
  )
);

CREATE POLICY "provider_invoices_files_insert"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'provider-invoices' AND (
    public.can_manage_tenant(public.storage_tenant_id(name), auth.uid())
    OR EXISTS (
      -- "objects.name": dentro do EXISTS, "name" sozinho seria o nome do motorista.
      SELECT 1 FROM public.drivers d
      WHERE d.id::text = split_part(objects.name, '/', 2)
        AND d.tenant_id = public.storage_tenant_id(objects.name)
        AND d.user_id = auth.uid()
    )
  )
);

CREATE POLICY "provider_invoices_files_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'provider-invoices' AND public.can_manage_tenant(public.storage_tenant_id(name), auth.uid()));

-- ============================================================================
-- 5. Realtime: acerto e app do motorista atualizam na hora
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOREACH t IN ARRAY ARRAY['carriers', 'provider_invoices']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
