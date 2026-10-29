-- Trigger to auto-fill tenant_id on fleet_positions from the driver's tenant
CREATE OR REPLACE FUNCTION public.enforce_fleet_position_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT d.tenant_id INTO NEW.tenant_id
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_fleet_position_tenant
  BEFORE INSERT OR UPDATE ON public.fleet_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fleet_position_tenant_id();