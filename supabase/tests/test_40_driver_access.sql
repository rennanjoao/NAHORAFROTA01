\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

-- Motorista do tenant A (papel viewer) grava GPS, baixa, comprovante e ocorrencia
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, driver_id, total_value) VALUES
 ('32000000-0000-0000-0000-000000000001','kd1','Rua D1','Cli D1','in_transit','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a',10);

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.fleet_positions (driver_id, tenant_id, latitude, longitude)
VALUES ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a', -23.5, -46.6);
UPDATE public.fleet_positions SET latitude = -23.6 WHERE driver_id = '20000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check((SELECT latitude FROM public.fleet_positions WHERE driver_id = '20000000-0000-0000-0000-00000000000a') = -23.6, 'motorista grava e atualiza a propria posicao');
INSERT INTO public.deliveries (invoice_id, driver_id, tenant_id, status)
VALUES ('32000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','delivered');
INSERT INTO public.delivery_proofs (invoice_id, driver_id, tenant_id, delivered_at)
VALUES ('32000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a', now());
INSERT INTO public.delivery_occurrences (invoice_id, driver_id, tenant_id, occurrence_type)
VALUES ('32000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','ausente');
INSERT INTO public.driver_occurrences (driver_id, tenant_id, type)
VALUES ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','avaria');
SELECT pg_temp.check((SELECT count(*) FROM public.deliveries) = 1, 'motorista le a propria baixa');
SELECT pg_temp.check((SELECT count(*) FROM public.delivery_proofs) = 1, 'motorista le o proprio comprovante');
SELECT pg_temp.check((SELECT count(*) FROM public.delivery_occurrences WHERE invoice_id = '32000000-0000-0000-0000-000000000001') = 1, 'motorista le a propria ocorrencia de entrega');
SELECT pg_temp.check((SELECT count(*) FROM public.driver_occurrences) = 1, 'motorista le a propria ocorrencia');
DO $$ BEGIN
  INSERT INTO public.fleet_positions (driver_id, tenant_id, latitude, longitude)
  VALUES (gen_random_uuid(),'10000000-0000-0000-0000-00000000000a', 0, 0);
  RAISE EXCEPTION 'FAIL: motorista gravou posicao de outro motorista';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao grava posicao de outro motorista';
END $$;
DO $$ BEGIN
  INSERT INTO public.driver_wallet (driver_id, tenant_id, amount)
  VALUES ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a', 1000);
  RAISE EXCEPTION 'FAIL: motorista lancou na propria carteira';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista so le a carteira';
END $$;
RESET role;

-- Equipe da empresa abre as fotos do motorista; outra empresa nao
INSERT INTO storage.objects (bucket_id, name) VALUES
 ('delivery-proofs','00000000-0000-0000-0000-0000000000d1/deliveries/1.jpg');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'delivery-proofs') = 1, 'despachante abre a foto do comprovante');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'delivery-proofs') = 0, 'outra empresa nao abre a foto');
SELECT pg_temp.check((SELECT count(*) FROM public.delivery_proofs) = 0, 'outra empresa nao le comprovantes');
RESET role;

-- delete_driver_complete: so admin/gestor da empresa; bloqueia com romaneio aberto
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000d2','driver.b@driver.nahorafrota.app');
INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES ('00000000-0000-0000-0000-0000000000d2','viewer','10000000-0000-0000-0000-00000000000a');
INSERT INTO public.drivers (id, user_id, name, cpf, phone, vehicle_plate, vehicle_type, status, tenant_id, avatar, cnh, cnh_category)
VALUES ('20000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000d2','Motorista B','52998224725','1198','XYZ1A23','van','active','10000000-0000-0000-0000-00000000000a','x','2','B');

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((public.delete_driver_complete('20000000-0000-0000-0000-00000000000b')->>'success')::boolean = false, 'outra empresa nao remove motorista');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
SELECT pg_temp.check((public.delete_driver_complete('20000000-0000-0000-0000-00000000000b')->>'success')::boolean = false, 'despachante nao remove motorista');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.delete_driver_complete('20000000-0000-0000-0000-00000000000a')->>'success')::boolean = false, 'motorista com romaneio aberto nao e removido');
SELECT pg_temp.check((public.delete_driver_complete('20000000-0000-0000-0000-00000000000b')->>'success')::boolean, 'admin remove motorista livre');
RESET role;
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000d2'), 'login do app do motorista removido junto');

-- delete_user_complete: so admin da empresa, nunca a si mesmo nem outra empresa
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
SELECT pg_temp.check((public.delete_user_complete('00000000-0000-0000-0000-0000000000a1')->>'success')::boolean = false, 'despachante nao remove o admin');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((public.delete_user_complete('00000000-0000-0000-0000-0000000000a2')->>'success')::boolean = false, 'admin de outra empresa nao remove usuario');
SELECT pg_temp.check((public.delete_user_complete('00000000-0000-0000-0000-0000000000c1')->>'success')::boolean = false, 'admin nao remove a si mesmo');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.delete_user_complete('00000000-0000-0000-0000-0000000000a2')->>'success')::boolean, 'admin remove usuario da propria empresa');
RESET role;
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000a2'), 'papeis do usuario removido apagados');

-- cleanup_ghost_drivers so mexe na propria empresa e respeita romaneio aberto
INSERT INTO public.drivers (id, name, cpf, phone, vehicle_plate, vehicle_type, status, tenant_id, avatar, cnh, cnh_category) VALUES
 ('20000000-0000-0000-0000-00000000000c','Fantasma A','11144477735','1','AAA1A11','van','in_route','10000000-0000-0000-0000-00000000000a','x','3','B'),
 ('20000000-0000-0000-0000-0000000000c1','Em rota C','39053344705','1','CCC1C11','van','in_route','10000000-0000-0000-0000-00000000000c','x','4','B');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT public.cleanup_ghost_drivers();
RESET role;
SELECT pg_temp.check((SELECT status FROM public.drivers WHERE id = '20000000-0000-0000-0000-00000000000c') = 'active', 'fantasma da propria empresa liberado');
SELECT pg_temp.check((SELECT status FROM public.drivers WHERE id = '20000000-0000-0000-0000-00000000000a') = 'in_route', 'motorista com romaneio aberto continua em rota');
SELECT pg_temp.check((SELECT status FROM public.drivers WHERE id = '20000000-0000-0000-0000-0000000000c1') = 'in_route', 'motorista de outra empresa intocado');

-- Teste gratis usa todos os recursos sem trocar o plano contratado
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.get_current_plan_status()->>'plan') = 'total', 'empresa em teste tem acesso completo');
SELECT pg_temp.check((public.get_current_plan_status()->>'contracted_plan') = 'basic', 'plano contratado preservado no teste');
SELECT pg_temp.check((public.get_current_plan_status()->>'is_trial')::boolean, 'status informa o teste');
RESET role;
SELECT pg_temp.check((SELECT plan FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000a') = 'basic', 'tenants.plan nao muda');

-- set_user_role: troca atomica, sem rebaixar a si mesmo nem o ultimo admin
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a3','gestor.a@x.com');
INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a3','member');
INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES
 ('00000000-0000-0000-0000-0000000000a3','viewer', NULL),
 ('00000000-0000-0000-0000-0000000000a3','dispatcher','10000000-0000-0000-0000-00000000000a');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.set_user_role('00000000-0000-0000-0000-0000000000a3','fleet_manager')->>'success')::boolean, 'admin promove usuario');
SELECT pg_temp.check((public.set_user_role('00000000-0000-0000-0000-0000000000a1','dispatcher')->>'success')::boolean = false, 'admin nao rebaixa a si mesmo');
SELECT pg_temp.check((public.set_user_role('00000000-0000-0000-0000-0000000000a3','viewer')->>'success')::boolean = false, 'painel nao atribui viewer');
RESET role;
SELECT pg_temp.check((SELECT array_agg(role::text) FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000a3') = ARRAY['fleet_manager'], 'usuario fica com um unico papel');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
SELECT pg_temp.check((public.set_user_role('00000000-0000-0000-0000-0000000000a1','dispatcher')->>'success')::boolean = false, 'gestor nao altera o admin');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((public.set_user_role('00000000-0000-0000-0000-0000000000a3','admin')->>'success')::boolean = false, 'outra empresa nao altera papel');
RESET role;

-- Gestor de frota remove login do app (sem papel de equipe), mas nao usuario do painel
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000d3','driver.c@driver.nahorafrota.app');
INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000d3','member');
INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES ('00000000-0000-0000-0000-0000000000d3','viewer','10000000-0000-0000-0000-00000000000a');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
SELECT pg_temp.check((public.delete_user_complete('00000000-0000-0000-0000-0000000000d3')->>'success')::boolean, 'gestor remove login do app');
SELECT pg_temp.check((public.delete_user_complete('00000000-0000-0000-0000-0000000000a1')->>'success')::boolean = false, 'gestor nao remove usuario do painel');
RESET role;

-- finalize_manifest: bloqueia NF em rota, devolve ocorrencias, nao libera motorista com outro romaneio
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date) VALUES
 ('50000000-0000-0000-0000-000000000040','20000000-0000-0000-0000-00000000000a','Motorista A','in_progress','10000000-0000-0000-0000-00000000000a', now(), current_date),
 ('50000000-0000-0000-0000-000000000041','20000000-0000-0000-0000-00000000000a','Motorista A','paid','10000000-0000-0000-0000-00000000000a', now(), current_date);
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, manifest_id, driver_id, total_value) VALUES
 ('33000000-0000-0000-0000-000000000001','kf1','Rua F1','Cli F1','delivered','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000040','20000000-0000-0000-0000-00000000000a',10),
 ('33000000-0000-0000-0000-000000000002','kf2','Rua F2','Cli F2','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000040','20000000-0000-0000-0000-00000000000a',10);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.finalize_manifest('50000000-0000-0000-0000-000000000040')->>'success')::boolean = false, 'nao finaliza com NF em rota');
SELECT pg_temp.check((public.finalize_manifest('50000000-0000-0000-0000-000000000041')->>'success')::boolean = false, 'nao mexe em romaneio pago');
RESET role;
UPDATE public.invoices SET status = 'occurrence', occurrence_type = 'ausente' WHERE id = '33000000-0000-0000-0000-000000000002';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((public.finalize_manifest('50000000-0000-0000-0000-000000000040')->>'success')::boolean = false, 'outra empresa nao finaliza');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.finalize_manifest('50000000-0000-0000-0000-000000000040')->>'returned_count')::int = 1, 'ocorrencia volta para roteirizacao');
RESET role;
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000040') = 'completed', 'romaneio finalizado');
SELECT pg_temp.check((SELECT status = 'returned' AND manifest_id IS NULL FROM public.invoices WHERE id = '33000000-0000-0000-0000-000000000002'), 'NF devolvida sem romaneio');
SELECT pg_temp.check((SELECT status FROM public.drivers WHERE id = '20000000-0000-0000-0000-00000000000a') = 'in_route', 'motorista com outro romaneio aberto continua em rota');

-- delete_manifest: entregues ficam entregues; abertas voltam a pendente; pago bloqueado
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date) VALUES
 ('50000000-0000-0000-0000-000000000050','20000000-0000-0000-0000-00000000000c','Fantasma A','in_progress','10000000-0000-0000-0000-00000000000a', now(), current_date);
UPDATE public.drivers SET status = 'in_route' WHERE id = '20000000-0000-0000-0000-00000000000c';
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, manifest_id, driver_id, total_value) VALUES
 ('34000000-0000-0000-0000-000000000001','kg1','Rua G1','Cli G1','delivered','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000050','20000000-0000-0000-0000-00000000000c',10),
 ('34000000-0000-0000-0000-000000000002','kg2','Rua G2','Cli G2','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000050','20000000-0000-0000-0000-00000000000c',10);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.delete_manifest('50000000-0000-0000-0000-000000000041')->>'success')::boolean = false, 'romaneio pago nao e excluido');
SELECT pg_temp.check((public.delete_manifest('50000000-0000-0000-0000-000000000050')->>'reopened_count')::int = 1, 'so a NF aberta volta a pendente');
RESET role;
SELECT pg_temp.check((SELECT status FROM public.invoices WHERE id = '34000000-0000-0000-0000-000000000001') = 'delivered', 'entrega feita nao e desfeita');
SELECT pg_temp.check((SELECT status = 'pending' AND driver_id IS NULL FROM public.invoices WHERE id = '34000000-0000-0000-0000-000000000002'), 'NF em rota volta a pendente');
SELECT pg_temp.check((SELECT status FROM public.drivers WHERE id = '20000000-0000-0000-0000-00000000000c') = 'active', 'motorista liberado ao excluir o romaneio');

-- Romaneio vai para "Em Rota" na primeira entrega e conclui na ultima
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date) VALUES
 ('50000000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000c','Fantasma A','pending','10000000-0000-0000-0000-00000000000a', now(), current_date);
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, manifest_id, driver_id, total_value) VALUES
 ('35000000-0000-0000-0000-000000000001','kh1','Rua H1','Cli H1','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000c',10),
 ('35000000-0000-0000-0000-000000000002','kh2','Rua H2','Cli H2','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000c',10);
UPDATE public.invoices SET status = 'delivered' WHERE id = '35000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000060') = 'in_progress', 'primeira entrega coloca o romaneio em rota');
UPDATE public.invoices SET status = 'delivered' WHERE id = '35000000-0000-0000-0000-000000000002';
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000060') = 'completed', 'ultima entrega conclui o romaneio');

-- Carteira: frete do romaneio de agregado acompanha o romaneio
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date, freight_value, is_own_fleet, manifest_code) VALUES
 ('50000000-0000-0000-0000-000000000070','20000000-0000-0000-0000-00000000000c','Fantasma A','pending','10000000-0000-0000-0000-00000000000a', now(), current_date, 120, false, 'ROM-W1');
SELECT pg_temp.check((SELECT amount FROM public.driver_wallet WHERE manifest_id = '50000000-0000-0000-0000-000000000070' AND type = 'freight') = 120, 'romaneio gera frete na carteira');
UPDATE public.manifests SET status = 'paid', freight_value = 130 WHERE id = '50000000-0000-0000-0000-000000000070';
SELECT pg_temp.check((SELECT status || ':' || amount FROM public.driver_wallet WHERE manifest_id = '50000000-0000-0000-0000-000000000070' AND type = 'freight') = 'paid:130', 'pagamento e valor refletem na carteira');
DELETE FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000070';
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.driver_wallet WHERE description LIKE '%ROM-W1%'), 'romaneio excluido sai da carteira');
SELECT pg_temp.check((SELECT completed_at IS NOT NULL FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000060'), 'conclusao grava completed_at');

-- Bloqueio automatico por atraso: so depois dos X dias configurados
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.tenants SET next_due_date = current_date - 2, auto_block_days = 5 WHERE id = '10000000-0000-0000-0000-00000000000c';
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000c') = 'active', 'atraso dentro do prazo nao bloqueia');
UPDATE public.tenants SET next_due_date = current_date - 6 WHERE id = '10000000-0000-0000-0000-00000000000c';
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000c') = 'overdue', 'atraso acima do prazo bloqueia');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((SELECT count(*) FROM public.invoices) = 0, 'cliente bloqueado por atraso nao le dados');
SELECT pg_temp.check((public.get_my_tenant_access()->>'auto_block_days')::int = 5, 'acesso informa o prazo de bloqueio');
RESET role;
SELECT set_config('request.jwt.claim.sub', '', false);
UPDATE public.tenants SET auto_block_days = 0 WHERE id = '10000000-0000-0000-0000-00000000000c';
SELECT pg_temp.check(public.tenant_access_state('10000000-0000-0000-0000-00000000000c') = 'active', 'prazo 0 = sem bloqueio automatico');
UPDATE public.tenants SET next_due_date = NULL WHERE id = '10000000-0000-0000-0000-00000000000c';
\echo ALL_DRIVER_ACCESS_TESTS_PASSED
