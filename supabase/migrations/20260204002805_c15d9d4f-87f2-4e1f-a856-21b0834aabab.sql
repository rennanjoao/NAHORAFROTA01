-- Add RLS policy to allow authorized roles to view all profiles for fleet coordination
-- This allows admin, fleet_manager, and dispatcher roles to see team member names for coordination
CREATE POLICY "Authorized roles can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'fleet_manager'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role)
);