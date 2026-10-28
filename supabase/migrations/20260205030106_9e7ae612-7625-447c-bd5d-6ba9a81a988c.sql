-- Add banking fields to drivers table
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS banco TEXT,
ADD COLUMN IF NOT EXISTS agencia TEXT,
ADD COLUMN IF NOT EXISTS conta TEXT,
ADD COLUMN IF NOT EXISTS tipo_conta TEXT DEFAULT 'corrente',
ADD COLUMN IF NOT EXISTS chave_pix TEXT;

-- Create audit log table for settlement reversals
CREATE TABLE IF NOT EXISTS public.settlement_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID REFERENCES public.settlements(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  performed_by UUID,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  notes TEXT
);

-- Enable RLS on audit logs
ALTER TABLE public.settlement_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can read audit logs"
ON public.settlement_audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authorized users can insert audit logs
CREATE POLICY "Authorized users can insert audit logs"
ON public.settlement_audit_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'fleet_manager'::app_role));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_settlement ON public.settlement_audit_logs(settlement_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON public.settlement_audit_logs(performed_at DESC);