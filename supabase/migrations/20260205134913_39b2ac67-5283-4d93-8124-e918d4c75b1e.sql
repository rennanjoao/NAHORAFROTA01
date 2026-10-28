-- ============================================
-- Create manifest_audit_logs table for tracking all changes
-- ============================================

CREATE TABLE IF NOT EXISTS public.manifest_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manifest_id UUID NOT NULL REFERENCES public.manifests(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'invoice_added', 'invoice_removed', 'delivery_confirmed', 'occurrence_registered', 'finalized'
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  details JSONB, -- Additional data like receiver_name, receiver_document, occurrence_type, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manifest_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authorized users can view audit logs"
ON public.manifest_audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

CREATE POLICY "Authorized users can insert audit logs"
ON public.manifest_audit_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

-- Add delivery confirmation fields to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS receiver_name TEXT,
ADD COLUMN IF NOT EXISTS receiver_document TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_manifest_audit_logs_manifest_id ON public.manifest_audit_logs(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_audit_logs_created_at ON public.manifest_audit_logs(created_at DESC);