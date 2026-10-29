-- =============================================================================
-- SECURITY FIX: Corrigir políticas RLS com mapeamento incorreto de driver_id
-- =============================================================================

-- 1. SETTLEMENTS: Remover política incorreta e manter apenas a correta
-- A política "Drivers can read own settlements" já usa o JOIN correto
DROP POLICY IF EXISTS "Regra Geral Financeiro" ON public.settlements;

-- 2. INVOICES: Remover políticas com mapeamento incorreto de driver_id
-- A política "Drivers can read assigned invoices" usa driver_id = auth.uid() (incorreto)
-- A política "Motorista vê notas do seu romaneio" usa m.driver_id = auth.uid() (incorreto)
-- A política "Regra Geral Invoices" também usa mapeamento incorreto
DROP POLICY IF EXISTS "Drivers can read assigned invoices" ON public.invoices;
DROP POLICY IF EXISTS "Motorista vê notas do seu romaneio" ON public.invoices;
DROP POLICY IF EXISTS "Regra Geral Invoices" ON public.invoices;

-- Criar política correta para motoristas verem suas notas fiscais
-- Usa JOIN com tabela drivers para mapear user_id corretamente
CREATE POLICY "Drivers can read own manifest invoices"
ON public.invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.manifests m
    JOIN public.drivers d ON d.id = m.driver_id
    WHERE m.id = invoices.manifest_id
    AND d.user_id = auth.uid()
  )
);

-- 3. DRIVERS: Criar view operacional para fleet_managers/dispatchers
-- Eles precisam ver dados operacionais mas NÃO dados sensíveis (CPF, CNH, banco, etc.)
CREATE OR REPLACE VIEW public.vw_drivers_operational
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  d.id,
  d.name,
  d.avatar,
  d.photo_url,
  d.vehicle_plate,
  d.vehicle_type,
  d.status,
  d.current_delay,
  d.individual_sla,
  d.daily_sla,
  d.deliveries_completed,
  d.total_deliveries,
  d.is_own_fleet,
  d.finished_time,
  d.gps_signal_status,
  d.last_gps_update,
  d.created_at,
  d.updated_at
FROM public.drivers d;

-- Comentário explicativo na view
COMMENT ON VIEW public.vw_drivers_operational IS 
'View operacional de motoristas - exclui dados sensíveis (CPF, CNH, dados bancários, endereço, contatos de emergência). Use esta view para fleet_managers e dispatchers. Admins devem usar a tabela drivers diretamente para acesso completo.';

-- Revogar acesso anônimo à view
REVOKE SELECT ON public.vw_drivers_operational FROM anon;

-- 4. Atualizar política de drivers para restringir fleet_managers apenas à view operacional
-- Primeiro, remover a política que permite fleet_managers verem TODOS os dados
DROP POLICY IF EXISTS "Admins and fleet managers can view all drivers" ON public.drivers;

-- Criar política que permite APENAS admins verem todos os dados sensíveis
CREATE POLICY "Only admins can view all driver details"
ON public.drivers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Nota: fleet_managers devem usar vw_drivers_operational ou get_operational_drivers() RPC