-- Create trigger function to reset driver status when manifest is deleted (not finalized)
CREATE OR REPLACE FUNCTION public.reset_driver_on_manifest_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only reset if manifest was NOT completed (meaning it was deleted while active)
  IF OLD.status NOT IN ('completed', 'paid') AND OLD.driver_id IS NOT NULL THEN
    -- Reset driver status to 'active' (available)
    UPDATE public.drivers
    SET 
      status = 'active',
      updated_at = pg_catalog.now()
    WHERE id = OLD.driver_id;
    
    -- Also reset company vehicle if applicable
    IF OLD.company_vehicle_id IS NOT NULL THEN
      UPDATE public.company_vehicles
      SET 
        status = 'available',
        current_driver_id = NULL,
        current_driver_name = NULL,
        updated_at = pg_catalog.now()
      WHERE id = OLD.company_vehicle_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create the trigger on manifests table
DROP TRIGGER IF EXISTS trigger_reset_driver_on_manifest_delete ON public.manifests;
CREATE TRIGGER trigger_reset_driver_on_manifest_delete
  BEFORE DELETE ON public.manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_driver_on_manifest_delete();

-- Also create trigger for manifest cancellation (status changed to cancelled)
CREATE OR REPLACE FUNCTION public.reset_driver_on_manifest_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If manifest is being cancelled or completed, reset driver status
  IF NEW.status IN ('cancelled', 'completed') AND OLD.status NOT IN ('cancelled', 'completed', 'paid') THEN
    IF NEW.driver_id IS NOT NULL THEN
      UPDATE public.drivers
      SET 
        status = 'active',
        updated_at = pg_catalog.now()
      WHERE id = NEW.driver_id;
    END IF;
    
    -- Also reset company vehicle if applicable
    IF NEW.company_vehicle_id IS NOT NULL THEN
      UPDATE public.company_vehicles
      SET 
        status = 'available',
        current_driver_id = NULL,
        current_driver_name = NULL,
        updated_at = pg_catalog.now()
      WHERE id = NEW.company_vehicle_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reset_driver_on_manifest_cancel ON public.manifests;
CREATE TRIGGER trigger_reset_driver_on_manifest_cancel
  BEFORE UPDATE ON public.manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_driver_on_manifest_cancel();