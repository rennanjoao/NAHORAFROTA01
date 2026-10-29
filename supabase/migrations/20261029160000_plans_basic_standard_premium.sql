-- Planos Basic, Standard e Premium (planilha de 29/10/2026).
-- Os ids gravados nas empresas continuam basic, control e total; muda o que cada um libera:
--   Basic    (basic):   3 motoristas e veiculos, 5 usuarios. Painel do dia, XML, acerto em lote.
--   Standard (control): 15 motoristas e veiculos, 20 usuarios. + mapa, SLA em tempo real,
--                       receita/custo/eficiencia do frete no painel.
--   Premium  (total):   50 motoristas e veiculos, usuarios ilimitados. + SLA por motorista.
-- Motorista alem do limite custa R$ 10/mes; por ora o time libera manualmente.
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE COALESCE(p_plan, 'basic')
    WHEN 'total' THEN jsonb_build_object(
      'max_users', -1,
      'max_drivers', 50,
      'max_vehicles', 50,
      'realtime', true,
      'batch_import', true,
      'sla_weekly', true,
      'sla_drilldown', true,
      'financial_dashboard', true
    )
    WHEN 'control' THEN jsonb_build_object(
      'max_users', 20,
      'max_drivers', 15,
      'max_vehicles', 15,
      'realtime', true,
      'batch_import', true,
      'sla_weekly', true,
      'sla_drilldown', false,
      'financial_dashboard', true
    )
    ELSE jsonb_build_object(
      'max_users', 5,
      'max_drivers', 3,
      'max_vehicles', 3,
      'realtime', false,
      'batch_import', true,
      'sla_weekly', false,
      'sla_drilldown', false,
      'financial_dashboard', false
    )
  END
$$;
