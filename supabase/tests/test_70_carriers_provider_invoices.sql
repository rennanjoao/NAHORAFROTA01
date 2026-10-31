\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

SELECT set_config('request.jwt.claim.sub', '', false);

-- Empresa propria deste arquivo: administrador, despachante, motorista TAC e motorista de transportadora
INSERT INTO public.tenants (id, cnpj, razao_social, status, plan) VALUES
 ('10000000-0000-0000-0000-000000000070','11222333000262','Empresa NF','active','total');
INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-0000-0000-000000000071','admin.nf@x.com'),
 ('00000000-0000-0000-0000-000000000072','disp.nf@x.com'),
 ('00000000-0000-0000-0000-000000000073','tac.nf@driver.nahorafrota.app'),
 ('00000000-0000-0000-0000-000000000074','transp.nf@driver.nahorafrota.app');
INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES
 ('10000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000071','admin'),
 ('10000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000072','member'),
 ('10000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000073','member'),
 ('10000000-0000-0000-0000-000000000070','00000000-0000-0000-0000-000000000074','member');
INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES
 ('00000000-0000-0000-0000-000000000071','admin','10000000-0000-0000-0000-000000000070'),
 ('00000000-0000-0000-0000-000000000072','dispatcher','10000000-0000-0000-0000-000000000070'),
 ('00000000-0000-0000-0000-000000000073','viewer','10000000-0000-0000-0000-000000000070'),
 ('00000000-0000-0000-0000-000000000074','viewer','10000000-0000-0000-0000-000000000070');
INSERT INTO public.drivers (id, user_id, name, cpf, phone, vehicle_plate, vehicle_type, status, tenant_id, avatar, cnh, cnh_category, is_own_fleet) VALUES
 ('20000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000073','Seu Osmar','11144477735','1197','OSM1A23','van','active','10000000-0000-0000-0000-000000000070','x','7','B', false),
 ('20000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-000000000074','Joaozinho','52998224725','1196','JOA1B23','van','active','10000000-0000-0000-0000-000000000070','x','8','B', false);

-- Pergunta da empresa
SELECT pg_temp.check((SELECT pays_only_with_invoice FROM public.tenants WHERE id = '10000000-0000-0000-0000-000000000070') IS NULL, 'empresa nova ainda nao respondeu se so paga com nota');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000071');
UPDATE public.tenants SET pays_only_with_invoice = true WHERE id = '10000000-0000-0000-0000-000000000070';
SELECT pg_temp.check((SELECT pays_only_with_invoice FROM public.tenants WHERE id = '10000000-0000-0000-0000-000000000070'), 'administrador responde: so paga mediante nota fiscal');

-- Transportadora: despachante cadastra; motorista nao ve nem se liga
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000072');
INSERT INTO public.carriers (id, tenant_id, razao_social, cnpj, inscricao_estadual, chave_pix)
VALUES ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000070','Transportadora Rapida LTDA','45997418000153','123456789','pix@rapida.com');
UPDATE public.drivers SET carrier_id = '70000000-0000-0000-0000-000000000001' WHERE id = '20000000-0000-0000-0000-000000000074';
SELECT pg_temp.check((SELECT carrier_id FROM public.drivers WHERE id = '20000000-0000-0000-0000-000000000074') IS NOT NULL, 'despachante cadastra a transportadora e liga o motorista');
DO $$ BEGIN
  INSERT INTO public.carriers (tenant_id, razao_social, cnpj) VALUES ('10000000-0000-0000-0000-000000000070','Duplicada','45997418000153');
  RAISE EXCEPTION 'FAIL: aceitou CNPJ repetido';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: CNPJ repetido na mesma empresa e recusado';
END $$;
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000073');
SELECT pg_temp.check((SELECT count(*) FROM public.carriers) = 0, 'motorista nao le transportadoras (nem dados bancarios)');
DO $$ BEGIN
  UPDATE public.drivers SET carrier_id = '70000000-0000-0000-0000-000000000001' WHERE id = '20000000-0000-0000-0000-000000000073';
  RAISE EXCEPTION 'FAIL: motorista se ligou a transportadora';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao troca a propria transportadora';
END $$;
SELECT pg_temp.check((public.get_my_payment_profile()->>'pays_only_with_invoice')::boolean, 'app do motorista sabe que a empresa so paga com nota');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000074');
SELECT pg_temp.check(public.get_my_payment_profile()->>'carrier_name' = 'Transportadora Rapida LTDA', 'motorista da transportadora ve por quem recebe');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
DO $$ BEGIN
  INSERT INTO public.carriers (tenant_id, razao_social, cnpj) VALUES ('10000000-0000-0000-0000-000000000070','Invasora','11444777000161');
  RAISE EXCEPTION 'FAIL: outra empresa cadastrou transportadora';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: outra empresa nao cadastra transportadora';
END $$;
RESET role;

-- Romaneios finalizados (dias 1, 2 e 3) e um ainda na rua (dia 4), horario de Brasilia
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date, freight_value, is_own_fleet) VALUES
 ('57000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000073','Seu Osmar','completed','10000000-0000-0000-0000-000000000070','2026-10-01 10:00-03','2026-10-01', 150, false),
 ('57000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000073','Seu Osmar','completed','10000000-0000-0000-0000-000000000070','2026-10-02 23:30-03','2026-10-02', 200, false),
 ('57000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000073','Seu Osmar','completed','10000000-0000-0000-0000-000000000070','2026-10-03 09:00-03','2026-10-03', 120, false),
 ('57000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000073','Seu Osmar','in_progress','10000000-0000-0000-0000-000000000070','2026-10-04 08:00-03','2026-10-04', 90, false),
 ('57000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000074','Joaozinho','completed','10000000-0000-0000-0000-000000000070','2026-10-01 10:00-03','2026-10-01', 300, false);

-- Motorista ve os dias com romaneio e o frete de cada um
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000073');
SELECT pg_temp.check((SELECT count(*) FROM public.provider_invoice_days('20000000-0000-0000-0000-000000000073', '2026-10-01', '2026-10-31')) = 4, 'motorista ve os 4 dias com romaneio');
SELECT pg_temp.check((SELECT freight FROM public.provider_invoice_days('20000000-0000-0000-0000-000000000073', '2026-10-01', '2026-10-31') WHERE work_date = '2026-10-02') = 200, 'romaneio das 23h30 conta no dia certo (horario de Brasilia)');
SELECT pg_temp.check((SELECT payable FROM public.provider_invoice_days('20000000-0000-0000-0000-000000000073', '2026-10-01', '2026-10-31') WHERE work_date = '2026-10-04') = 0, 'dia com romaneio na rua ainda nao tem valor a receber');
DO $$ BEGIN
  PERFORM public.provider_invoice_days('20000000-0000-0000-0000-000000000074', '2026-10-01', '2026-10-31');
  RAISE EXCEPTION 'FAIL: viu os dias de outro motorista';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao ve os dias de outro motorista';
END $$;

-- Seu Osmar escolhe os dias errados (1 e 2), anexa a nota e depois corrige (enquanto nao aprovada)
INSERT INTO storage.objects (bucket_id, name) VALUES ('provider-invoices', '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf');
SELECT set_config('test.nf1', public.submit_provider_invoice(NULL, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01','2026-10-02']::date[], '1001', '2026-10-05', 350, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf')::text, false);
SELECT pg_temp.check((SELECT status = 'pending' AND expected_amount = 350 FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'nota enviada fica aguardando aprovacao, com o frete dos dias');
SELECT pg_temp.check((SELECT count(*) FROM public.manifests WHERE provider_invoice_id = current_setting('test.nf1')::uuid) = 2, 'nota ligada aos 2 romaneios dos dias escolhidos');
SELECT public.submit_provider_invoice(current_setting('test.nf1')::uuid, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01','2026-10-02','2026-10-03']::date[], '1001', '2026-10-05', 470, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf');
SELECT pg_temp.check((SELECT expected_amount = 470 AND cardinality(work_dates) = 3 FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'motorista corrige os dias antes da aprovacao');
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(NULL, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-03']::date[], '1002', NULL, 10, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'x.pdf');
  RAISE EXCEPTION 'FAIL: aceitou dia repetido em outra nota';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: o mesmo dia nao entra em duas notas';
END $$;
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(NULL, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-09']::date[], '1003', NULL, 10, 'outra-empresa/nf.pdf', 'x.pdf');
  RAISE EXCEPTION 'FAIL: aceitou arquivo fora da pasta da empresa';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: arquivo precisa estar na pasta da empresa';
END $$;
SELECT pg_temp.check((SELECT count(*) FROM public.provider_invoices) = 1, 'motorista le a propria nota');
DO $$ BEGIN
  UPDATE public.provider_invoices SET status = 'approved';
  RAISE EXCEPTION 'FAIL: motorista aprovou a propria nota';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao altera a nota direto (so pelas funcoes)';
END $$;
DO $$ BEGIN
  PERFORM public.review_provider_invoice(current_setting('test.nf1')::uuid, true, NULL);
  RAISE EXCEPTION 'FAIL: motorista aprovou pela funcao';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao aprova a propria nota';
END $$;
RESET role;

-- Motorista da transportadora nao envia nota (a regra da nota nao vale para transportadora)
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000074');
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(NULL, '20000000-0000-0000-0000-000000000074', ARRAY['2026-10-01']::date[], '9', NULL, 300, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000074/n.pdf', 'n.pdf');
  RAISE EXCEPTION 'FAIL: motorista de transportadora enviou nota';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: motorista de transportadora nao envia nota';
END $$;
SELECT pg_temp.check((SELECT count(*) FROM public.provider_invoices) = 0, 'motorista nao le nota de outro motorista');
RESET role;

-- Sem nota aprovada, o romaneio nao vai para pago
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000072');
DO $$ BEGIN
  UPDATE public.manifests SET status = 'paid', paid_at = now() WHERE id = '57000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'FAIL: pagou sem nota aprovada';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: romaneio nao e pago antes da nota aprovada';
END $$;

-- Recusa com motivo; motorista corrige e reenvia; despachante aprova
DO $$ BEGIN
  PERFORM public.review_provider_invoice(current_setting('test.nf1')::uuid, false, '  ');
  RAISE EXCEPTION 'FAIL: recusou sem motivo';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: recusa pede o motivo';
END $$;
SELECT public.review_provider_invoice(current_setting('test.nf1')::uuid, false, 'Valor diferente do frete');
SELECT pg_temp.check((SELECT status = 'rejected' AND review_note = 'Valor diferente do frete' FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'despachante recusa com motivo');
SELECT pg_temp.check((SELECT count(*) FROM public.manifests WHERE provider_invoice_id = current_setting('test.nf1')::uuid) = 0, 'nota recusada solta os romaneios');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000073');
SELECT public.submit_provider_invoice(current_setting('test.nf1')::uuid, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01','2026-10-02','2026-10-03']::date[], '1001', '2026-10-05', 470, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf');
SELECT pg_temp.check((SELECT status = 'pending' AND review_note IS NULL FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'motorista corrige a nota recusada e ela volta para aprovacao');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000072');
SELECT public.review_provider_invoice(current_setting('test.nf1')::uuid, true, NULL);
SELECT pg_temp.check((SELECT status = 'approved' AND expected_amount = 470 FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'despachante aprova a nota');
RESET role;

-- Aprovada: motorista e despachante nao editam; administrador edita
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000073');
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(current_setting('test.nf1')::uuid, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01']::date[], '1001', NULL, 10, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf');
  RAISE EXCEPTION 'FAIL: motorista editou nota aprovada';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao edita nota aprovada';
END $$;
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000072');
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(current_setting('test.nf1')::uuid, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01']::date[], '1001', NULL, 10, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf');
  RAISE EXCEPTION 'FAIL: despachante editou nota aprovada';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: despachante nao edita nota aprovada';
END $$;
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000071');
SELECT public.submit_provider_invoice(current_setting('test.nf1')::uuid, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01','2026-10-02','2026-10-03','2026-10-04']::date[], '1001-A', '2026-10-05', 470, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf');
SELECT pg_temp.check((SELECT status = 'approved' AND invoice_number = '1001-A' FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'administrador edita a nota aprovada (continua aprovada)');
RESET role;

-- Romaneio do dia 4 termina depois: entra sozinho na nota que cobre o dia
UPDATE public.manifests SET status = 'completed' WHERE id = '57000000-0000-0000-0000-000000000004';
SELECT pg_temp.check((SELECT provider_invoice_id::text FROM public.manifests WHERE id = '57000000-0000-0000-0000-000000000004') = current_setting('test.nf1'), 'romaneio finalizado depois entra na nota do dia');
SELECT pg_temp.check((SELECT expected_amount FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid) = 560, 'valor esperado da nota acompanha o romaneio novo');

-- Pagamento: libera com a nota aprovada; nota vira paga quando todos os romaneios forem pagos
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000072');
UPDATE public.manifests SET status = 'paid', paid_at = now() WHERE id IN ('57000000-0000-0000-0000-000000000001','57000000-0000-0000-0000-000000000002','57000000-0000-0000-0000-000000000003');
SELECT pg_temp.check((SELECT status FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid) = 'approved', 'nota segue aprovada com romaneio ainda sem pagamento');
UPDATE public.manifests SET status = 'paid', paid_at = now() WHERE id = '57000000-0000-0000-0000-000000000004';
SELECT pg_temp.check((SELECT status = 'paid' AND paid_at IS NOT NULL FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid), 'nota fica paga quando todos os romaneios dela sao pagos');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000071');
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(current_setting('test.nf1')::uuid, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-01']::date[], '1001', NULL, 10, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf1.pdf', 'nf1.pdf');
  RAISE EXCEPTION 'FAIL: editou nota paga';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: nota paga nao e editada (estorna antes)';
END $$;
UPDATE public.manifests SET status = 'completed', paid_at = NULL WHERE id = '57000000-0000-0000-0000-000000000004';
SELECT pg_temp.check((SELECT status FROM public.provider_invoices WHERE id = current_setting('test.nf1')::uuid) = 'approved', 'estorno volta a nota para aprovada');
RESET role;

-- Transportadora fora da regra: romaneio do motorista dela e pago sem nota
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000072');
UPDATE public.manifests SET status = 'paid', paid_at = now() WHERE id = '57000000-0000-0000-0000-000000000005';
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '57000000-0000-0000-0000-000000000005') = 'paid', 'romaneio do motorista de transportadora e pago sem nota fiscal');
DO $$ BEGIN
  PERFORM public.submit_provider_invoice(NULL, '20000000-0000-0000-0000-000000000074', ARRAY['2026-10-01']::date[], 'T-55', NULL, 300, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000074/t55.pdf', 't55.pdf');
  RAISE EXCEPTION 'FAIL: equipe enviou nota para motorista de transportadora';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: nem a equipe envia nota para motorista de transportadora';
END $$;
RESET role;

-- Empresa que nao exige nota paga como antes
UPDATE public.tenants SET pays_only_with_invoice = false WHERE id = '10000000-0000-0000-0000-000000000070';
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, created_at, scheduled_date, freight_value, is_own_fleet) VALUES
 ('57000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000073','Seu Osmar','completed','10000000-0000-0000-0000-000000000070','2026-10-10 10:00-03','2026-10-10', 80, false);
UPDATE public.manifests SET status = 'paid' WHERE id = '57000000-0000-0000-0000-000000000006';
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '57000000-0000-0000-0000-000000000006') = 'paid', 'sem a regra da nota, o pagamento segue como antes');

-- Arquivo da nota: motorista so na propria pasta; outra empresa nao abre
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000073');
DO $$ BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('provider-invoices', '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000074/x.pdf');
  RAISE EXCEPTION 'FAIL: motorista enviou na pasta de outro';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista so envia na propria pasta';
END $$;
INSERT INTO storage.objects (bucket_id, name) VALUES ('provider-invoices', '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf2.pdf');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'provider-invoices') = 2, 'motorista abre os proprios arquivos');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'provider-invoices') = 0, 'outra empresa nao abre as notas');
SELECT pg_temp.check((SELECT count(*) FROM public.provider_invoices) = 0, 'outra empresa nao le as notas');
RESET role;

-- Exclusao: motorista exclui pendente; aprovada so o administrador
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000073');
SELECT set_config('test.nf3', public.submit_provider_invoice(NULL, '20000000-0000-0000-0000-000000000073', ARRAY['2026-10-20']::date[], '2000', NULL, 50, '10000000-0000-0000-0000-000000000070/20000000-0000-0000-0000-000000000073/nf2.pdf', 'nf2.pdf')::text, false);
SELECT public.delete_provider_invoice(current_setting('test.nf3')::uuid);
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.provider_invoices WHERE id = current_setting('test.nf3')::uuid), 'motorista exclui a nota ainda nao aprovada');
DO $$ BEGIN
  PERFORM public.delete_provider_invoice(current_setting('test.nf1')::uuid);
  RAISE EXCEPTION 'FAIL: motorista excluiu nota aprovada';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao exclui nota aprovada';
END $$;
RESET role;
