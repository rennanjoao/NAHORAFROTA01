
-- Safety net trigger: if a driver is inserted with NULL tenant_id, 
-- auto-fill from the caller's tenant_memberships
CREATE OR REPLACE FUNCTION public.enforce_driver_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Only act if tenant_id is NULL
  IF NEW.tenant_id IS NULL THEN
    -- Try to get tenant from the inserting user's membership
    SELECT tm.tenant_id INTO v_tenant_id
    FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
    LIMIT 1;
    
    -- If caller has no membership, try the driver's own user_id membership
    IF v_tenant_id IS NULL AND NEW.user_id IS NOT NULL THEN
      SELECT tm.tenant_id INTO v_tenant_id
      FROM public.tenant_memberships tm
      WHERE tm.user_id = NEW.user_id
      LIMIT 1;
    END IF;

    IF v_tenant_id IS NOT NULL THEN
      NEW.tenant_id := v_tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_enforce_driver_tenant ON public.drivers;
CREATE TRIGGER trg_enforce_driver_tenant
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_tenant_id();
