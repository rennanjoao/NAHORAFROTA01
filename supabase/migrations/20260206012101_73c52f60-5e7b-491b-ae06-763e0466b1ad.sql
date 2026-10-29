-- Drop the old status check constraint
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_status_check;

-- Add new constraint with correct status values
ALTER TABLE public.drivers ADD CONSTRAINT drivers_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'in_route'::text, 'inactive'::text, 'break'::text, 'offline'::text]));

-- Update drivers with open manifests to have 'in_route' status
UPDATE public.drivers d
SET status = 'in_route', updated_at = now()
WHERE d.id IN (
  SELECT DISTINCT m.driver_id 
  FROM public.manifests m 
  WHERE m.driver_id IS NOT NULL 
  AND m.status NOT IN ('completed', 'cancelled', 'paid')
)
AND d.status = 'active';