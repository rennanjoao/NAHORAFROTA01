-- Fix: Drop the permissive policy and ensure proper role-based policy exists
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;

-- Recreate with proper role restrictions (drop first to avoid conflict)
DROP POLICY IF EXISTS "Authorized users can insert invoices" ON public.invoices;

CREATE POLICY "Authorized users can insert invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);