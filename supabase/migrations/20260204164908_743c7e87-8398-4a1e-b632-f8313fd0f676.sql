-- Create driver_occurrences table for reporting incidents
CREATE TABLE public.driver_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('accident', 'delay', 'mechanical', 'other')),
  description TEXT,
  photo_url TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_occurrences ENABLE ROW LEVEL SECURITY;

-- Policies for driver_occurrences
CREATE POLICY "Drivers can insert own occurrences"
ON public.driver_occurrences
FOR INSERT
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can view own occurrences"
ON public.driver_occurrences
FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Admins and fleet managers can view all occurrences"
ON public.driver_occurrences
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'fleet_manager'::app_role));

CREATE POLICY "Admins can delete occurrences"
ON public.driver_occurrences
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create driver_wallet table for payment tracking
CREATE TABLE public.driver_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  route_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_wallet ENABLE ROW LEVEL SECURITY;

-- Policies for driver_wallet
CREATE POLICY "Drivers can view own wallet"
ON public.driver_wallet
FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Admins and fleet managers can manage wallet"
ON public.driver_wallet
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'fleet_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'fleet_manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_driver_wallet_updated_at
BEFORE UPDATE ON public.driver_wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create delivery_proofs table for POD (Proof of Delivery)
CREATE TABLE public.delivery_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  signature_url TEXT,
  receiver_name TEXT,
  receiver_document TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_proofs
CREATE POLICY "Drivers can insert own delivery proofs"
ON public.delivery_proofs
FOR INSERT
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can view own delivery proofs"
ON public.delivery_proofs
FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY "Admins and fleet managers can view all proofs"
ON public.delivery_proofs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'fleet_manager'::app_role) OR has_role(auth.uid(), 'dispatcher'::app_role));

CREATE POLICY "Admins can delete proofs"
ON public.delivery_proofs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for delivery proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true);

-- Storage policies for delivery-proofs bucket
CREATE POLICY "Anyone can view delivery proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'delivery-proofs');

CREATE POLICY "Authenticated users can upload delivery proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own delivery proofs"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'delivery-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);