\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

-- Manifest M3: NF re-roteirizada com occurrence_type antigo -> deve finalizar sozinho
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date) VALUES
 ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-00000000000a','Motorista A','in_progress','10000000-0000-0000-0000-00000000000a', now() - interval '1 hour', current_date),
 ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-00000000000a','Motorista A','in_progress','10000000-0000-0000-0000-00000000000a', now() - interval '1 hour', current_date);
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, manifest_id, driver_id, occurrence_type, total_value) VALUES
 ('31000000-0000-0000-0000-000000000005','k5','Rua 5','Cli 5','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-00000000000a','recusa_recebimento',10),
 ('31000000-0000-0000-0000-000000000006','k6','Rua 6','Cli 6','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-00000000000a', NULL, 10);
UPDATE public.invoices SET status = 'delivered' WHERE id = '31000000-0000-0000-0000-000000000005';
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000003') = 'completed', 'ocorrencia de roteirizacao anterior nao trava a auto-finalizacao');

-- M4: ocorrencia registrada pelo painel (sem delivery_occurrences) e depois entregue -> nao finaliza
UPDATE public.invoices SET status = 'occurrence', occurrence_type = 'horario_restrito' WHERE id = '31000000-0000-0000-0000-000000000006';
UPDATE public.invoices SET status = 'delivered' WHERE id = '31000000-0000-0000-0000-000000000006';
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000004') = 'in_progress', 'ocorrencia pelo painel trava a auto-finalizacao');

-- Trial bloqueado (nunca contratou) pode voltar ao teste
INSERT INTO public.tenants (id, cnpj, razao_social, status, plan, trial_started_at, trial_ends_at) VALUES
 ('10000000-0000-0000-0000-00000000000d','04252011000110','Trial Bloqueado','blocked','basic', now() - interval '10 days', now() - interval '3 days');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
SELECT public.extend_tenant_trial('10000000-0000-0000-0000-00000000000d', 7);
RESET role;
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000d') = 'trial', 'trial bloqueado volta ao teste sem virar conversao');
SELECT pg_temp.check((SELECT converted_at IS NULL FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000d'), 'extensao nao marca converted_at');

-- Usuario sem empresa nao enxerga o tenant padrao
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000e1', 'orfao@x.com');
INSERT INTO public.tenants (id, cnpj, razao_social, status, slug, next_due_date) VALUES
 ('10000000-0000-0000-0000-0000000000ff','27865757000102','Tenant Padrao','active','rennanjoao', current_date + 3);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
SELECT pg_temp.check((public.get_my_tenant_access()->>'tenant_id') IS NULL, 'usuario sem vinculo nao recebe dados do tenant padrao');
RESET role;

-- anon nao executa funcoes internas
SELECT set_config('request.jwt.claim.sub', '', false), set_config('role', 'anon', false);
DO $$ BEGIN
  PERFORM public.tenant_access_state('10000000-0000-0000-0000-00000000000a');
  RAISE EXCEPTION 'FAIL: anon executou tenant_access_state';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon nao consulta estado de tenant';
END $$;
SELECT public.track_funnel_event('visitor_zzz12345', 'page_view', '/login', '{}');
RESET role;
SELECT pg_temp.check(true, 'anon continua registrando o funil');

-- Empresa nao apaga arquivo de documento (so o Super Admin)
INSERT INTO storage.objects (bucket_id, name) VALUES ('driver-documents','20000000-0000-0000-0000-00000000000a/cnh/9-cnh.pdf');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
DELETE FROM storage.objects WHERE name = '20000000-0000-0000-0000-00000000000a/cnh/9-cnh.pdf';
RESET role;
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE name = '20000000-0000-0000-0000-00000000000a/cnh/9-cnh.pdf') = 1, 'empresa nao apaga o arquivo');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
DELETE FROM storage.objects WHERE name = '20000000-0000-0000-0000-00000000000a/cnh/9-cnh.pdf';
RESET role;
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE name = '20000000-0000-0000-0000-00000000000a/cnh/9-cnh.pdf') = 0, 'Super Admin apaga o arquivo');
\echo ALL_REVIEW_FIX_TESTS_PASSED
