-- Postgres ON CONFLICT (user_id) needs a real unique/exclusion constraint.
-- The partial unique index used during the mhn bootstrap is not enough for
-- create_driver_complete, which upserts drivers by user_id.

DROP INDEX IF EXISTS public.drivers_user_id_unique;
DROP INDEX IF EXISTS public.idx_drivers_user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drivers_user_id_key'
      AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
