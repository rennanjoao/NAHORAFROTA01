\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

-- Manifest M1: 2 NFs, no occurrence. Manifest M2: 2 NFs, one had an occurrence.
INSERT INTO public.company_vehicles (id, plate, type, status, tenant_id) VALUES ('40000000-0000-0000-0000-000000000001','XYZ','Van','in_use','10000000-0000-0000-0000-00000000000a');
INSERT INTO public.manifests (id, driver_id, driver_name, status, tenant_id, company_vehicle_id, created_at, scheduled_date) VALUES
 ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a','Motorista A','in_progress','10000000-0000-0000-0000-00000000000a','40000000-0000-0000-0000-000000000001', now() - interval '3 hours', current_date),
 ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-00000000000a','Motorista A','in_progress','10000000-0000-0000-0000-00000000000a', NULL, now() - interval '3 hours', current_date);
INSERT INTO public.invoices (id, access_key, address_full, recipient_name, status, tenant_id, manifest_id, driver_id, latitude, longitude, total_value) VALUES
 ('31000000-0000-0000-0000-000000000001','k1','Av Paulista 1000','Cli 1','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a', -23.5614, -46.6559, 10),
 ('31000000-0000-0000-0000-000000000002','k2','Rua 2','Cli 2','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a', NULL, NULL, 10),
 ('31000000-0000-0000-0000-000000000003','k3','Rua 3','Cli 3','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-00000000000a', NULL, NULL, 10),
 ('31000000-0000-0000-0000-000000000004','k4','Rua 4','Cli 4','in_transit','10000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-00000000000a', NULL, NULL, 10),
 ('31000000-0000-0000-0000-000000000009','k9','Outro','Cli 9','in_transit','10000000-0000-0000-0000-00000000000c', NULL, NULL, -23.5614, -46.6559, 10);

-- Arrival: driver of tenant A
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.check((public.register_driver_arrival('31000000-0000-0000-0000-000000000001', -23.5630, -46.6559)->>'reason') = 'too_far', 'a ~180m nao conta como chegada');
SELECT pg_temp.check((public.register_driver_arrival('31000000-0000-0000-0000-000000000001', -23.5620, -46.6559)->>'arrived')::boolean, 'a ~67m conta como chegada');
SELECT pg_temp.check((public.register_driver_arrival('31000000-0000-0000-0000-000000000001', -23.5620, -46.6559)->>'already')::boolean, 'chegada nao e sobrescrita');
SELECT pg_temp.check((public.register_driver_arrival('31000000-0000-0000-0000-000000000002', -23.5620, -46.6559)->>'reason') = 'no_coordinates', 'sem coordenadas nao marca');
SELECT pg_temp.check((public.register_driver_arrival('31000000-0000-0000-0000-000000000009', -23.5614, -46.6559)->>'reason') = 'not_assigned', 'NF de outro motorista/tenant e recusada');
SELECT pg_temp.check((public.register_driver_arrival('31000000-0000-0000-0000-000000000001', -23.5614, -46.6559, 5000)->>'already')::boolean, 'raio limitado a 100m (ja chegou)');
RESET role;
SELECT pg_temp.check((SELECT arrived_at IS NOT NULL AND arrival_distance_m < 100 FROM public.invoices WHERE id = '31000000-0000-0000-0000-000000000001'), 'arrived_at gravado com distancia');

-- Driver delivers M1 (through RLS policy driver_update_assigned_invoices)
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
UPDATE public.invoices SET status = 'delivered', delivered_at = now() WHERE id = '31000000-0000-0000-0000-000000000001';
RESET role;
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000001') = 'in_progress', 'romaneio nao finaliza com NF pendente');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
UPDATE public.invoices SET status = 'delivered', delivered_at = now() WHERE id = '31000000-0000-0000-0000-000000000002';
RESET role;
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000001') = 'completed', 'romaneio finaliza sozinho quando todas entregues');
SELECT pg_temp.check((SELECT status FROM public.company_vehicles WHERE id = '40000000-0000-0000-0000-000000000001') = 'available', 'veiculo da casa liberado');
SELECT pg_temp.check((SELECT status FROM public.drivers WHERE id = '20000000-0000-0000-0000-00000000000a') = 'in_route', 'motorista continua em rota pois ainda tem outro romaneio aberto');
SELECT pg_temp.check((SELECT count(*) FROM public.manifest_audit_logs WHERE action_type = 'auto_finalized') = 1, 'auditoria da auto-finalizacao');

-- M2: occurrence then delivered -> stays open
INSERT INTO public.delivery_occurrences (invoice_id, driver_id, occurrence_type, tenant_id) VALUES ('31000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-00000000000a','recusa_recebimento','10000000-0000-0000-0000-00000000000a');
UPDATE public.invoices SET status = 'occurrence', occurrence_type = 'recusa_recebimento' WHERE id = '31000000-0000-0000-0000-000000000003';
UPDATE public.invoices SET status = 'delivered' WHERE id IN ('31000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000004');
SELECT pg_temp.check((SELECT status FROM public.manifests WHERE id = '50000000-0000-0000-0000-000000000002') = 'in_progress', 'romaneio com ocorrencia nao finaliza sozinho');

-- Driver documents storage: tenant admin can upload but not read; platform admin reads
INSERT INTO public.driver_documents (driver_id, tenant_id, document_type, file_path) VALUES ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','cnh','20000000-0000-0000-0000-00000000000a/cnh/1-cnh.pdf');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
INSERT INTO storage.objects (bucket_id, name) VALUES ('driver-documents','20000000-0000-0000-0000-00000000000a/cnh/1-cnh.pdf');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'driver-documents') = 0, 'admin do cliente envia mas nao abre o documento');
SELECT pg_temp.check((SELECT count(*) FROM public.driver_documents) = 1, 'admin do cliente ve que o documento existe');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'driver-documents') = 1, 'Super Admin abre o documento');
RESET role;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
SELECT pg_temp.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'driver-documents') = 0, 'motorista nao abre o documento');
RESET role;
\echo ALL_OPS_TESTS_PASSED
