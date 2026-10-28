-- Adicionar coluna user_id na tabela drivers para vincular ao usuário autenticado
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Criar índice único para garantir que um user_id só pode ter um driver
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id) WHERE user_id IS NOT NULL;

-- Adicionar política para motoristas verem seus próprios dados
CREATE POLICY "Drivers can view own data"
ON public.drivers
FOR SELECT
USING (user_id = auth.uid());

-- Atualizar política de update para motoristas atualizarem seus próprios dados
CREATE POLICY "Drivers can update own data"
ON public.drivers
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Atualizar políticas de fleet_positions para motoristas gerenciarem suas posições
DROP POLICY IF EXISTS "Fleet managers can insert fleet positions" ON public.fleet_positions;
DROP POLICY IF EXISTS "Fleet managers can update fleet positions" ON public.fleet_positions;

CREATE POLICY "Authorized users can insert fleet positions"
ON public.fleet_positions
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'fleet_manager') OR 
  has_role(auth.uid(), 'dispatcher') OR 
  driver_id::text = auth.uid()::text
);

CREATE POLICY "Authorized users can update fleet positions"
ON public.fleet_positions
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'fleet_manager') OR 
  has_role(auth.uid(), 'dispatcher') OR 
  driver_id::text = auth.uid()::text
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'fleet_manager') OR 
  has_role(auth.uid(), 'dispatcher') OR 
  driver_id::text = auth.uid()::text
);

-- Adicionar delete policy para limpar posições antigas
CREATE POLICY "Admins can delete fleet positions"
ON public.fleet_positions
FOR DELETE
USING (has_role(auth.uid(), 'admin'));