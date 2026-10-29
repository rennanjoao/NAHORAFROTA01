-- Add recipient_phone column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS recipient_phone TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.recipient_phone IS 'Telefone do destinatário extraído do XML da NF-e (tag dest/enderDest/fone ou dest/fone)';