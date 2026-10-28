
-- Remove políticas incorretas que comparam auth.uid() diretamente com driver_id
DROP POLICY IF EXISTS "Motorista vê seus romaneios" ON public.manifests;
DROP POLICY IF EXISTS "Regra Geral Manifests" ON public.manifests;

-- A política correta já existe: "Drivers can view own manifests"
-- Ela usa o JOIN correto: driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
