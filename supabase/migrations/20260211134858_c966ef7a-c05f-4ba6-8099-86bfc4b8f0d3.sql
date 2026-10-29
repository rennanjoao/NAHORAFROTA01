
-- Safety net trigger: if an invoice is inserted with NULL tenant_id,
-- auto-fill from the caller's tenant_memberships
CREATE OR REPLACE FUNCTION public.enforce_invoice_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tm.tenant_id INTO v_tenant_id
    FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
      NEW.tenant_id := v_tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_tenant ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_tenant
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_tenant_id();
