\set ON_ERROR_STOP 1
-- Fixtures (as superuser)
INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-0000-0000-0000000000a1','admin.a@x.com'),
 ('00000000-0000-0000-0000-0000000000a2','disp.a@x.com'),
 ('00000000-0000-0000-0000-0000000000b1','admin.b@x.com'),
 ('00000000-0000-0000-0000-0000000000c1','admin.c@x.com'),
 ('00000000-0000-0000-0000-0000000000d1','driver.a@driver.nahorafrota.app'),
 ('00000000-0000-0000-0000-0000000000f1','platform@x.com');
INSERT INTO public.tenants (id, cnpj, razao_social, status, plan, trial_started_at, trial_ends_at) VALUES
 ('10000000-0000-0000-0000-00000000000a','11222333000181','Trial Ativo','trial','basic', now() - interval '2 days', now() + interval '5 days'),
 ('10000000-0000-0000-0000-00000000000b','11444777000161','Trial Expirado','trial','basic', now() - interval '9 days', now() - interval '2 days'),
 ('10000000-0000-0000-0000-00000000000c','45997418000153','Cliente Pagante','active','total', NULL, NULL);
INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','admin'),
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a2','member'),
 ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','admin'),
 ('10000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','admin'),
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000d1','member');
INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES
 ('00000000-0000-0000-0000-0000000000a1','admin','10000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-0000000000a2','dispatcher','10000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-0000000000b1','admin','10000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-0000000000c1','admin','10000000-0000-0000-0000-00000000000c'),
 ('00000000-0000-0000-0000-0000000000d1','viewer','10000000-0000-0000-0000-00000000000a');
INSERT INTO public.platform_admins (user_id) VALUES ('00000000-0000-0000-0000-0000000000f1');
INSERT INTO public.drivers (id, user_id, name, cpf, phone, vehicle_plate, vehicle_type, status, tenant_id, avatar, cnh, cnh_category)
VALUES ('20000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000d1','Motorista A','12345678909','1199','ABC1D23','van','in_route','10000000-0000-0000-0000-00000000000a','x','1','B');
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, total_value) VALUES
 ('30000000-0000-0000-0000-0000000000b1','kb1','Rua B','Cliente B','pending','10000000-0000-0000-0000-00000000000b',10),
 ('30000000-0000-0000-0000-0000000000c1','kc1','Rua C','Cliente C','pending','10000000-0000-0000-0000-00000000000c',10);

CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

-- access states
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000a') = 'trial', 'trial ativo');
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000b') = 'trial_expired', 'trial expirado');
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000c') = 'active', 'pagante ativo');

-- RLS: expired trial admin sees no invoices, but still reads own tenant and access RPC
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
SELECT pg_temp.check((SELECT count(*) FROM public.invoices) = 0, 'trial expirado nao le NFs');
SELECT pg_temp.check((SELECT count(*) FROM public.tenants) = 1, 'trial expirado ainda le o proprio tenant');
SELECT pg_temp.check((public.get_my_tenant_access()->>'access_state') = 'trial_expired', 'RPC de acesso informa trial_expired');
RESET role;

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((SELECT count(*) FROM public.invoices) = 1, 'pagante le as proprias NFs');
SELECT pg_temp.check((SELECT count(*) FROM public.invoices WHERE tenant_id <> '10000000-0000-0000-0000-00000000000c') = 0, 'isolamento entre tenants mantido');
RESET role;

-- Guard: tenant admin cannot change billing fields, can change company data
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
UPDATE public.tenants SET razao_social = 'Trial Ativo LTDA' WHERE id = '10000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check((SELECT razao_social FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000a') = 'Trial Ativo LTDA', 'admin edita dados da empresa');
DO $$ BEGIN
  UPDATE public.tenants SET trial_ends_at = now() + interval '1 year' WHERE id = '10000000-0000-0000-0000-00000000000a';
  RAISE EXCEPTION 'FAIL: admin conseguiu estender o proprio trial';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: admin nao altera trial_ends_at';
END $$;
DO $$ BEGIN
  UPDATE public.tenants SET billing_document = '12345678909' WHERE id = '10000000-0000-0000-0000-00000000000a';
  RAISE EXCEPTION 'FAIL: admin trocou documento de cobranca';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: documento de cobranca travado';
END $$;
DO $$ BEGIN
  PERFORM public.extend_tenant_trial('10000000-0000-0000-0000-00000000000a', 7);
  RAISE EXCEPTION 'FAIL: admin do cliente estendeu trial';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: so Super Admin estende trial';
END $$;
RESET role;

-- Dispatcher cannot edit company nor roles
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
UPDATE public.tenants SET razao_social = 'Hack' WHERE id = '10000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check((SELECT razao_social FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000a') = 'Trial Ativo LTDA', 'despachante nao edita empresa');
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '00000000-0000-0000-0000-0000000000a2';
RESET role;
SELECT pg_temp.check((SELECT role::text FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000a2') = 'dispatcher', 'despachante nao se promove a admin');

-- Platform admin extends expired trial -> access restored and logged
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
SELECT public.extend_tenant_trial('10000000-0000-0000-0000-00000000000b', 7);
RESET role;
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000b') = 'trial', 'extensao reativa o trial');
SELECT pg_temp.check((SELECT trial_ends_at > now() + interval '6 days' FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000b'), 'extensao conta 7 dias a partir de hoje');
SELECT pg_temp.check((SELECT count(*) FROM public.funnel_events WHERE event = 'trial_extended') = 1, 'extensao registrada no funil');

-- Conversion stamps converted_at and logs funnel event
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
UPDATE public.tenants SET status = 'active' WHERE id = '10000000-0000-0000-0000-00000000000b';
RESET role;
SELECT pg_temp.check((SELECT converted_at IS NOT NULL FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000b'), 'ativacao marca converted_at');
SELECT pg_temp.check((SELECT count(*) FROM public.funnel_events WHERE event = 'converted') = 1, 'conversao registrada no funil');

-- Funnel tracking from anon with dedupe and validation
SELECT set_config('request.jwt.claim.sub', '', false), set_config('role', 'anon', false);
SELECT public.track_funnel_event('visitor_abc12345', 'page_view', '/login', '{"utm_source":"google"}');
SELECT public.track_funnel_event('visitor_abc12345', 'page_view', '/login', '{}');
SELECT public.track_funnel_event('visitor_abc12345', 'register_started', '/register', '{}');
SELECT public.track_funnel_event('bad id!', 'page_view', '/login', '{}');
SELECT public.track_funnel_event('visitor_abc12345', 'converted', '/x', '{}');
DO $$ BEGIN
  PERFORM count(*) FROM public.funnel_events;
  RAISE EXCEPTION 'FAIL: anon leu funnel_events';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon nao le o funil';
END $$;
RESET role;
SELECT pg_temp.check((SELECT count(*) FROM public.funnel_events WHERE visitor_id = 'visitor_abc12345') = 2, 'dedupe + allowlist de eventos');

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.check((public.get_funnel_summary(now() - interval '1 day', now() + interval '1 day')->>'visitors')::int = 1, 'resumo do funil conta visitantes');
SELECT pg_temp.check((public.get_funnel_summary(now() - interval '1 day', now() + interval '1 day')->>'abandoned_registrations')::int = 1, 'resumo conta cadastro abandonado');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
DO $$ BEGIN
  PERFORM public.get_funnel_summary(now() - interval '1 day', now());
  RAISE EXCEPTION 'FAIL: cliente leu o funil';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: funil restrito ao Super Admin';
END $$;
-- Billing notice from tenant popup
SELECT public.record_billing_notice('trial_ending', (now() + interval '5 days')::date, false);
SELECT public.record_billing_notice('trial_ending', (now() + interval '5 days')::date, true);
RESET role;
SELECT pg_temp.check((SELECT count(*) FROM public.billing_notices) = 1 AND (SELECT acknowledged_at IS NOT NULL FROM public.billing_notices), 'aviso de cobranca registrado e confirmado (sem duplicar)');
\echo ALL_TRIAL_BILLING_TESTS_PASSED
