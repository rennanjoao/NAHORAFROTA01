-- Fix XML import columns and refresh PostgREST schema cache.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient_phone text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address_neighborhood text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS volume_quantity integer;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xml_raw text;

UPDATE public.invoices
SET
  volume_quantity = COALESCE(volume_quantity, volume_count),
  address_full = COALESCE(address_full, delivery_address, recipient_address),
  address_street = COALESCE(address_street, delivery_address, recipient_address),
  address_city = COALESCE(address_city, destination_city),
  address_state = COALESCE(address_state, destination_state);

NOTIFY pgrst, 'reload schema';
