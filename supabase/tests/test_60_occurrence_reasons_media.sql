\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

SELECT set_config('request.jwt.claim.sub', '', false);
-- Despachante proprio deste arquivo (os anteriores mudam papeis dos usuarios de test_10)
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a6','disp6.a@x.com');
INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a6','member');
INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES ('00000000-0000-0000-0000-0000000000a6','dispatcher','10000000-0000-0000-0000-00000000000a');

-- Motivos de ocorrencia: lista padrao para empresas novas (as de test_10 nasceram depois da migration)
SELECT pg_temp.check((SELECT count(*) FROM public.occurrence_reasons WHERE tenant_id = '10000000-0000-0000-0000-00000000000a') = 9, 'empresa nova recebe os 9 motivos padrao');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.occurrence_reasons WHERE tenant_id = '10000000-0000-0000-0000-00000000000a' AND code = 'estabelecimento_fechado'), 'lista padrao tem "Estabelecimento fechado"');
SELECT public.seed_occurrence_reasons('10000000-0000-0000-0000-00000000000a');
SELECT pg_temp.check((SELECT count(*) FROM public.occurrence_reasons WHERE tenant_id = '10000000-0000-0000-0000-00000000000a') = 9, 'rodar a lista padrao de novo nao duplica');

-- Motorista le os motivos da propria empresa e nao altera
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.check((SELECT count(*) FROM public.occurrence_reasons) = 9, 'motorista le so os motivos da propria empresa');
UPDATE public.occurrence_reasons SET label = 'Hackeado' WHERE code = 'avaria';
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.occurrence_reasons WHERE label = 'Hackeado'), 'motorista nao renomeia motivo');
RESET role;

-- Despachante inclui e desliga motivos; outra empresa nao ve
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
INSERT INTO public.occurrence_reasons (tenant_id, code, label) VALUES ('10000000-0000-0000-0000-00000000000a', 'loja_fechada_balanco', 'Loja fechada para balanço');
UPDATE public.occurrence_reasons SET active = false WHERE code = 'extravio' AND tenant_id = '10000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check((SELECT count(*) FROM public.occurrence_reasons WHERE active) = 9, 'despachante inclui um motivo e desliga outro');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.occurrence_reasons WHERE code = 'loja_fechada_balanco'), 'outra empresa nao ve os motivos');
DO $$ BEGIN
  INSERT INTO public.occurrence_reasons (tenant_id, code, label) VALUES ('10000000-0000-0000-0000-00000000000a', 'invasor', 'Invasor');
  RAISE EXCEPTION 'FAIL: outra empresa incluiu motivo';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: outra empresa nao inclui motivo';
END $$;
RESET role;

-- Ocorrencia do motorista: so com motivo ativo da empresa
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, driver_id, total_value) VALUES
 ('36060000-0000-0000-0000-000000000060','k60','Rua 60','Mercado 60','in_transit','10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a',10);
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.delivery_occurrences (invoice_id, driver_id, tenant_id, occurrence_type, description)
VALUES ('36060000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','loja_fechada_balanco','Volto amanha');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.delivery_occurrences WHERE occurrence_type = 'loja_fechada_balanco'), 'motorista registra ocorrencia com motivo da empresa e observacao livre');
DO $$ BEGIN
  INSERT INTO public.delivery_occurrences (invoice_id, driver_id, tenant_id, occurrence_type)
  VALUES ('36060000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','qualquer_coisa');
  RAISE EXCEPTION 'FAIL: aceitou motivo fora da lista';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: motivo fora da lista e recusado';
END $$;
DO $$ BEGIN
  INSERT INTO public.delivery_occurrences (invoice_id, driver_id, tenant_id, occurrence_type)
  VALUES ('36060000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','extravio');
  RAISE EXCEPTION 'FAIL: aceitou motivo desligado';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: motivo desligado e recusado';
END $$;
-- Sem tenant_id na linha (o app nao manda): a empresa sai do motorista
DO $$ BEGIN
  INSERT INTO public.delivery_occurrences (invoice_id, driver_id, occurrence_type)
  VALUES ('36060000-0000-0000-0000-000000000060','20000000-0000-0000-0000-00000000000a','qualquer_coisa');
  RAISE EXCEPTION 'FAIL: aceitou motivo fora da lista sem tenant';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: confere o motivo mesmo sem tenant na linha';
END $$;
RESET role;

-- Logo e fotos: pasta da empresa no bucket publico tenant-media
SELECT pg_temp.check((SELECT public FROM storage.buckets WHERE id = 'tenant-media'), 'bucket tenant-media e publico');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
INSERT INTO storage.objects (bucket_id, name) VALUES ('tenant-media', '10000000-0000-0000-0000-00000000000a/logo/l.png');
UPDATE public.tenants SET logo_url = 'https://x/storage/v1/object/public/tenant-media/10000000-0000-0000-0000-00000000000a/logo/l.png' WHERE id = '10000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check((SELECT logo_url FROM public.tenants WHERE id = '10000000-0000-0000-0000-00000000000a') LIKE '%/logo/l.png', 'administrador envia e grava o logo');
DO $$ BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('tenant-media', '10000000-0000-0000-0000-00000000000c/logo/x.png');
  RAISE EXCEPTION 'FAIL: enviou na pasta de outra empresa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: nao envia na pasta de outra empresa';
END $$;
DO $$ BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('tenant-media', 'sem-pasta.png');
  RAISE EXCEPTION 'FAIL: enviou fora de pasta de empresa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: nao envia fora da pasta da empresa';
END $$;
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
INSERT INTO storage.objects (bucket_id, name) VALUES ('tenant-media', '10000000-0000-0000-0000-00000000000a/drivers/d.jpg');
UPDATE public.drivers SET photo_url = 'u', vehicle_photo_url = 'v' WHERE id = '20000000-0000-0000-0000-00000000000a';
SELECT pg_temp.check((SELECT vehicle_photo_url FROM public.drivers WHERE id = '20000000-0000-0000-0000-00000000000a') = 'v', 'despachante envia foto do motorista e do veiculo');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
DO $$ BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('tenant-media', '10000000-0000-0000-0000-00000000000a/drivers/m.jpg');
  RAISE EXCEPTION 'FAIL: motorista enviou imagem da empresa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: motorista nao envia imagem da empresa';
END $$;
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
DELETE FROM storage.objects WHERE bucket_id = 'tenant-media' AND name LIKE '10000000-0000-0000-0000-00000000000a/%';
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'tenant-media') = 0, 'outra empresa nao lista as imagens');
RESET role;
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'tenant-media') = 2, 'outra empresa nao apaga as imagens');
SELECT pg_temp.check(public.storage_tenant_id('nao-e-uuid/x.png') IS NULL, 'pasta que nao e id de empresa nao da acesso');
