-- Ensure tenant plan changes can store when the current plan started.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz DEFAULT now();

UPDATE public.tenants
SET plan_started_at = COALESCE(plan_started_at, created_at, now())
WHERE plan_started_at IS NULL;

NOTIFY pgrst, 'reload schema';
