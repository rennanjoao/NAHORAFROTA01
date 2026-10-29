-- =====================================================
-- MANIFESTS TABLE - Romaneios com vinculo a motoristas
-- =====================================================
CREATE TABLE IF NOT EXISTS public.manifests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manifest_code TEXT NOT NULL UNIQUE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL,
  driver_cpf TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  is_own_fleet BOOLEAN DEFAULT false,
  company_vehicle_id UUID REFERENCES public.company_vehicles(id) ON DELETE SET NULL,
  freight_type TEXT NOT NULL DEFAULT 'fixed' CHECK (freight_type IN ('fixed', 'lumpsum', 'per_km')),
  freight_value NUMERIC NOT NULL DEFAULT 0,
  per_km_value NUMERIC,
  estimated_distance NUMERIC,
  deliveries_count INTEGER NOT NULL DEFAULT 0,
  total_weight NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'paid', 'cancelled')),
  observation TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Add index for driver lookups
CREATE INDEX idx_manifests_driver_id ON public.manifests(driver_id);
CREATE INDEX idx_manifests_status ON public.manifests(status);
CREATE INDEX idx_manifests_scheduled_date ON public.manifests(scheduled_date);
CREATE INDEX idx_manifests_is_own_fleet ON public.manifests(is_own_fleet);

-- =====================================================
-- SETTLEMENTS TABLE - Acertos Financeiros de Terceiros
-- =====================================================
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'disputed')),
  total_freight NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  total_additions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC GENERATED ALWAYS AS (total_freight + total_additions - total_deductions) STORED,
  paid_amount NUMERIC DEFAULT 0,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID,
  payment_method TEXT,
  payment_reference TEXT,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for driver settlements
CREATE INDEX idx_settlements_driver_id ON public.settlements(driver_id);
CREATE INDEX idx_settlements_status ON public.settlements(status);

-- =====================================================
-- SETTLEMENT_ITEMS - Itens do Acerto (Romaneios e Ajustes)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.settlement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  manifest_id UUID REFERENCES public.manifests(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('freight', 'bonus', 'discount', 'advance', 'toll', 'fuel', 'unloading', 'other')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  is_deduction BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlement_items_settlement ON public.settlement_items(settlement_id);
CREATE INDEX idx_settlement_items_manifest ON public.settlement_items(manifest_id);

-- =====================================================
-- Enable RLS on all tables
-- =====================================================
ALTER TABLE public.manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for Manifests
-- =====================================================
CREATE POLICY "Authorized users can read manifests"
ON public.manifests FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Drivers can read own manifests"
ON public.manifests FOR SELECT
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "Authorized users can insert manifests"
ON public.manifests FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Authorized users can update manifests"
ON public.manifests FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Admins can delete manifests"
ON public.manifests FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- RLS Policies for Settlements
-- =====================================================
CREATE POLICY "Authorized users can read settlements"
ON public.settlements FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
);

CREATE POLICY "Drivers can read own settlements"
ON public.settlements FOR SELECT
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "Authorized users can manage settlements"
ON public.settlements FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
);

-- =====================================================
-- RLS Policies for Settlement Items
-- =====================================================
CREATE POLICY "Authorized users can read settlement items"
ON public.settlement_items FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
);

CREATE POLICY "Drivers can read own settlement items"
ON public.settlement_items FOR SELECT
USING (
  settlement_id IN (
    SELECT s.id FROM public.settlements s 
    JOIN public.drivers d ON s.driver_id = d.id 
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Authorized users can manage settlement items"
ON public.settlement_items FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role)
);

-- =====================================================
-- Function to auto-create settlement for third-party drivers
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_create_settlement_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_is_own_fleet BOOLEAN;
  v_open_settlement_id UUID;
  v_driver_name TEXT;
BEGIN
  -- Only process if manifest has a driver and freight value > 0
  IF NEW.driver_id IS NULL OR NEW.freight_value <= 0 THEN
    RETURN NEW;
  END IF;

  -- Check if driver is third-party (not own fleet)
  SELECT is_own_fleet, COALESCE(name, 'Motorista') 
  INTO v_driver_is_own_fleet, v_driver_name
  FROM public.drivers 
  WHERE id = NEW.driver_id;

  -- Only create settlement for third-party drivers (is_own_fleet = false)
  IF v_driver_is_own_fleet = true OR v_driver_is_own_fleet IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find or create open settlement for this driver
  SELECT id INTO v_open_settlement_id
  FROM public.settlements
  WHERE driver_id = NEW.driver_id 
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_open_settlement_id IS NULL THEN
    -- Create new open settlement
    INSERT INTO public.settlements (driver_id, driver_name, period_start, status, total_freight)
    VALUES (NEW.driver_id, v_driver_name, CURRENT_DATE, 'open', NEW.freight_value)
    RETURNING id INTO v_open_settlement_id;
  ELSE
    -- Update total freight on existing settlement
    UPDATE public.settlements
    SET total_freight = total_freight + NEW.freight_value,
        updated_at = pg_catalog.now()
    WHERE id = v_open_settlement_id;
  END IF;

  -- Create settlement item for this manifest
  INSERT INTO public.settlement_items (
    settlement_id, 
    manifest_id, 
    item_type, 
    description, 
    amount, 
    is_deduction
  ) VALUES (
    v_open_settlement_id,
    NEW.id,
    'freight',
    'Frete Romaneio ' || NEW.manifest_code,
    NEW.freight_value,
    false
  );

  RETURN NEW;
END;
$$;

-- =====================================================
-- Trigger to auto-create settlement when manifest is created
-- =====================================================
CREATE TRIGGER trigger_auto_settlement
AFTER INSERT ON public.manifests
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_settlement_item();

-- =====================================================
-- Update timestamps triggers
-- =====================================================
CREATE TRIGGER update_manifests_updated_at
BEFORE UPDATE ON public.manifests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at
BEFORE UPDATE ON public.settlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Link invoices to manifests (add manifest_id FK if missing)
-- =====================================================
-- manifest_id already exists in invoices table, just ensure index
CREATE INDEX IF NOT EXISTS idx_invoices_manifest_id ON public.invoices(manifest_id);