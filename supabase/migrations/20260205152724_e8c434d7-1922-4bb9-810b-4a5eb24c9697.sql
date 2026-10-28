-- Remove overly permissive RLS policies that bypass security

-- Drop problematic policies on manifests
DROP POLICY IF EXISTS "Liberar Romaneios" ON public.manifests;

-- Drop problematic policies on driver_occurrences  
DROP POLICY IF EXISTS "Liberar Ocorrencias" ON public.driver_occurrences;
DROP POLICY IF EXISTS "Painel pode ver ocorrencias" ON public.driver_occurrences;

-- Drop overly permissive policies on deliveries
DROP POLICY IF EXISTS "Admin ve tudo" ON public.deliveries;

-- Recreate proper delivery_proofs policy (remove the "authenticated can view" all proofs)
DROP POLICY IF EXISTS "Authenticated can view proofs" ON public.delivery_proofs;

-- Create proper policy for delivery proofs - only admin/fleet_manager and the driver who delivered
CREATE POLICY "Authorized users can view delivery proofs" 
ON public.delivery_proofs 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  driver_id = auth.uid()
);

-- Fix deliveries table: only admin/fleet_manager/dispatcher and assigned driver
CREATE POLICY "Admins and managers can view all deliveries" 
ON public.deliveries 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

-- Fix driver_occurrences: proper role-based access
CREATE POLICY "Authorized users can view occurrences" 
ON public.driver_occurrences 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  driver_id = auth.uid()
);