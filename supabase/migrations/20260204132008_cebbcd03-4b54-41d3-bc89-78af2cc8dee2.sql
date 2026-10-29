-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for invoices (Notas Fiscais)
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_key TEXT NOT NULL UNIQUE,
  nfe_number TEXT,
  recipient_name TEXT NOT NULL,
  address_full TEXT NOT NULL,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  total_value NUMERIC NOT NULL DEFAULT 0,
  total_weight NUMERIC DEFAULT 0,
  volume_quantity INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  manifest_id UUID,
  driver_id UUID,
  occurrence_type TEXT,
  observation TEXT,
  imported_by UUID,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  xml_raw TEXT
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authorized users can read invoices"
ON public.invoices FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Authorized users can insert invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Authorized users can update invoices"
ON public.invoices FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Admins can delete invoices"
ON public.invoices FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_invoices_access_key ON public.invoices(access_key);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_manifest_id ON public.invoices(manifest_id);

-- Create trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();