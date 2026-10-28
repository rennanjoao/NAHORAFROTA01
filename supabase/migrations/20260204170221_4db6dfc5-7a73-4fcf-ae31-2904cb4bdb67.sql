-- Create company_vehicles table for house fleet vehicles
CREATE TABLE public.company_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  brand TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Fiorino', 'VUC', 'Toco', 'Truck', 'Carreta', 'Van')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
  capacity TEXT,
  year INTEGER,
  renavam TEXT,
  current_driver_id UUID,
  current_driver_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_vehicles
CREATE POLICY "Authenticated users can read vehicles"
  ON public.company_vehicles FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Admins and fleet managers can insert vehicles"
  ON public.company_vehicles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'fleet_manager'));

CREATE POLICY "Admins and fleet managers can update vehicles"
  ON public.company_vehicles FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'fleet_manager'));

CREATE POLICY "Admins can delete vehicles"
  ON public.company_vehicles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_company_vehicles_updated_at
  BEFORE UPDATE ON public.company_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();