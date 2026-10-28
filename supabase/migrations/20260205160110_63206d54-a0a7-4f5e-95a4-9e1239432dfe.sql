
-- Fix drivers table: Remove overlapping and incorrect RLS policies

-- Drop problematic policies that use incorrect comparisons (auth.uid() = id is wrong, should be user_id = auth.uid())
DROP POLICY IF EXISTS "Regra Geral Drivers" ON public.drivers;
DROP POLICY IF EXISTS "Regra de Visualização Geral" ON public.drivers;

-- The correct policies already exist:
-- "Admins and fleet managers can view all drivers" - uses has_role()
-- "Dispatchers can view driver operational data" - uses has_role()
-- "Drivers can view own record" - uses user_id = auth.uid()
-- "Admins podem criar/editar/excluir motoristas" - uses is_admin()

-- Verify driver self-update policy exists (driver can update their own record)
DROP POLICY IF EXISTS "Drivers can update own record" ON public.drivers;
CREATE POLICY "Drivers can update own record" 
ON public.drivers 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
