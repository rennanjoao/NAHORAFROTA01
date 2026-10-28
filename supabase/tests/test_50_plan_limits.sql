\set ON_ERROR_STOP 1
CREATE OR REPLACE FUNCTION pg_temp.as_user(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p::text, false), set_config('role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(p_ok, false) THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF; RAISE NOTICE 'ok: %', p_label; END $$;

SELECT set_config('request.jwt.claim.sub', '', false);
INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-0000-0000-0000000000a5','disp2.a@x.com');

-- Teste gratis (plano contratado "basic") usa os limites do plano completo
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES ('00000000-0000-0000-0000-0000000000a5','dispatcher','10000000-0000-0000-0000-00000000000a');
SELECT pg_temp.check(public.tenant_effective_plan('10000000-0000-0000-0000-00000000000a') = 'total', 'teste gratis usa o plano completo');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000a5'), 'teste gratis cadastra usuario alem do limite do basic');

-- Fora do teste vale o plano contratado (limites lidos de get_plan_limits)
INSERT INTO public.tenants (id, cnpj, razao_social, status, plan) VALUES
 ('10000000-0000-0000-0000-0000000000e5','11444777000242','Cliente Basic','active','basic');
SELECT pg_temp.check(public.tenant_effective_plan('10000000-0000-0000-0000-0000000000e5') = 'basic', 'fora do teste vale o plano contratado');
INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-0000-0000-000000e5' || lpad(g::text, 4, '0'))::uuid, 'lim' || g || '@x.com'
FROM generate_series(1, (public.get_plan_limits('basic')->>'max_users')::int + 1) g;
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT ('00000000-0000-0000-0000-000000e5' || lpad(g::text, 4, '0'))::uuid, 'dispatcher', '10000000-0000-0000-0000-0000000000e5'
FROM generate_series(1, (public.get_plan_limits('basic')->>'max_users')::int) g;
DO $$ BEGIN
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (('00000000-0000-0000-0000-000000e5' || lpad(((public.get_plan_limits('basic')->>'max_users')::int + 1)::text, 4, '0'))::uuid,
          'dispatcher', '10000000-0000-0000-0000-0000000000e5');
  RAISE EXCEPTION 'FAIL: passou do limite de usuarios do basic';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok: limite de usuarios do basic respeitado';
END $$;

-- Trocar o papel de quem ja e usuario nao conta como usuario novo
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES ('00000000-0000-0000-0000-000000e50001','fleet_manager','10000000-0000-0000-0000-0000000000e5');
SELECT pg_temp.check((SELECT count(*) FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000e50001') = 2, 'troca de papel no limite do plano funciona');

-- Veiculos tambem tem limite no banco
INSERT INTO public.company_vehicles (plate, type, status, tenant_id)
SELECT 'LIM' || g, 'Van', 'available', '10000000-0000-0000-0000-0000000000e5'
FROM generate_series(1, (public.get_plan_limits('basic')->>'max_vehicles')::int) g;
DO $$ BEGIN
  INSERT INTO public.company_vehicles (plate, type, status, tenant_id)
  VALUES ('LIMX', 'Van', 'available', '10000000-0000-0000-0000-0000000000e5');
  RAISE EXCEPTION 'FAIL: passou do limite de veiculos do basic';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok: limite de veiculos do basic respeitado';
END $$;

-- check_plan_limit segue o plano efetivo e so responde para a propria empresa
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.check((public.check_plan_limit('10000000-0000-0000-0000-00000000000a', 'users')->>'max') = public.get_plan_limits('total')->>'max_users', 'check_plan_limit usa o plano do teste gratis');
DO $$ BEGIN
  PERFORM public.check_plan_limit('10000000-0000-0000-0000-00000000000c', 'users');
  RAISE EXCEPTION 'FAIL: check_plan_limit respondeu sobre outra empresa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: check_plan_limit nao responde sobre outra empresa';
END $$;
RESET role;
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000a5';
\echo ALL_PLAN_LIMIT_TESTS_PASSED
