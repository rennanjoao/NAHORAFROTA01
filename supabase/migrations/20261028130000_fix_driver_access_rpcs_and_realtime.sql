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
