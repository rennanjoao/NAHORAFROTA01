-- PostgREST upsert onConflict needs a non-partial unique/exclusion constraint.
-- XML import always sends access_key, so use a regular unique constraint.
DROP INDEX IF EXISTS public.invoices_access_key_unique;

UPDATE public.invoices
SET access_key = id::text
WHERE access_key IS NULL OR btrim(access_key) = '';

ALTER TABLE public.invoices
ALTER COLUMN access_key SET NOT NULL;

ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_access_key_key;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_access_key_key UNIQUE (access_key);

NOTIFY pgrst, 'reload schema';
