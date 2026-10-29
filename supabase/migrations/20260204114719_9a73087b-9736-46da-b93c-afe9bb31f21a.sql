-- Create driver activity logs table for real-time monitoring
CREATE TABLE public.driver_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  manifest_id UUID,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('displacement_start', 'arrival', 'delivery_complete', 'occurrence')),
  client_name TEXT,
  occurrence_type TEXT,
  notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_driver_activity_logs_driver_id ON public.driver_activity_logs(driver_id);
CREATE INDEX idx_driver_activity_logs_created_at ON public.driver_activity_logs(created_at DESC);
CREATE INDEX idx_driver_activity_logs_manifest_id ON public.driver_activity_logs(manifest_id);

-- RLS Policies: Authorized users can read logs
CREATE POLICY "Authorized users can read activity logs"
ON public.driver_activity_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role) OR 
  driver_id = auth.uid()
);

-- Drivers can insert their own logs
CREATE POLICY "Drivers can insert own activity logs"
ON public.driver_activity_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role) OR 
  driver_id = auth.uid()
);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_activity_logs;