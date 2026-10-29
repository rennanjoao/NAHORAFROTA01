-- Tabela de posições GPS em tempo real
CREATE TABLE public.fleet_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  driver_name TEXT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  speed DECIMAL(6,2) DEFAULT 0,
  heading DECIMAL(5,2) DEFAULT 0,
  accuracy DECIMAL(6,2) DEFAULT 0,
  battery_level INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  last_update TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(driver_id)
);

-- Índices para performance
CREATE INDEX idx_fleet_positions_driver ON public.fleet_positions(driver_id);
CREATE INDEX idx_fleet_positions_active ON public.fleet_positions(is_active) WHERE is_active = true;
CREATE INDEX idx_fleet_positions_last_update ON public.fleet_positions(last_update DESC);

-- Habilitar Row Level Security
ALTER TABLE public.fleet_positions ENABLE ROW LEVEL SECURITY;

-- Policy: Qualquer usuário autenticado pode ler posições ativas
CREATE POLICY "Anyone can read active fleet positions"
ON public.fleet_positions FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy: Usuários podem inserir/atualizar posições (para demo sem auth completo)
CREATE POLICY "Users can upsert fleet positions"
ON public.fleet_positions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update fleet positions"
ON public.fleet_positions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger: Atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION public.update_fleet_position_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_update = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fleet_timestamp
BEFORE UPDATE ON public.fleet_positions
FOR EACH ROW EXECUTE FUNCTION public.update_fleet_position_timestamp();

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_positions;