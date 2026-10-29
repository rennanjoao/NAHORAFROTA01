-- Fix delivery occurrence compatibility between legacy and current app flows.
-- Some clients still submit invoice_id and the database may have legacy triggers
-- that reference NEW.invoice_id. Keep both linkage fields in sync and store photos.

ALTER TABLE public.delivery_occurrences
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.delivery_occurrences
ADD COLUMN IF NOT EXISTS photo_url TEXT;

UPDATE public.delivery_occurrences do
SET invoice_id = d.invoice_id
FROM public.deliveries d
WHERE do.delivery_id = d.id
  AND do.invoice_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_delivery_occurrence_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.delivery_id IS NULL AND NEW.invoice_id IS NOT NULL THEN
    SELECT id
    INTO NEW.delivery_id
    FROM public.deliveries
    WHERE invoice_id = NEW.invoice_id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF NEW.invoice_id IS NULL AND NEW.delivery_id IS NOT NULL THEN
    SELECT invoice_id
    INTO NEW.invoice_id
    FROM public.deliveries
    WHERE id = NEW.delivery_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_delivery_occurrence_links_before_write ON public.delivery_occurrences;

CREATE TRIGGER sync_delivery_occurrence_links_before_write
BEFORE INSERT OR UPDATE ON public.delivery_occurrences
FOR EACH ROW
EXECUTE FUNCTION public.sync_delivery_occurrence_links();
