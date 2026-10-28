-- 1. Create the trigger to call auto_create_settlement_item on manifest insert
DROP TRIGGER IF EXISTS trigger_auto_settlement ON public.manifests;

CREATE TRIGGER trigger_auto_settlement
AFTER INSERT ON public.manifests
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_settlement_item();

-- 2. Create function to update settlement when manifest freight changes
CREATE OR REPLACE FUNCTION public.update_settlement_on_manifest_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_settlement_item_id UUID;
  v_settlement_id UUID;
  v_old_amount NUMERIC;
BEGIN
  -- Find the settlement item for this manifest
  SELECT id, settlement_id, amount 
  INTO v_settlement_item_id, v_settlement_id, v_old_amount
  FROM public.settlement_items
  WHERE manifest_id = NEW.id AND item_type = 'freight';

  -- If no settlement item exists, nothing to update
  IF v_settlement_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If freight value changed, update the settlement item and recalculate totals
  IF OLD.freight_value IS DISTINCT FROM NEW.freight_value THEN
    -- Update the settlement item amount
    UPDATE public.settlement_items
    SET 
      amount = NEW.freight_value,
      description = 'Frete Romaneio ' || NEW.manifest_code
    WHERE id = v_settlement_item_id;

    -- Recalculate settlement totals
    UPDATE public.settlements
    SET 
      total_freight = (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.settlement_items
        WHERE settlement_id = v_settlement_id 
          AND item_type = 'freight' 
          AND is_deduction = false
      ),
      updated_at = pg_catalog.now()
    WHERE id = v_settlement_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create trigger for manifest updates
DROP TRIGGER IF EXISTS trigger_update_settlement ON public.manifests;

CREATE TRIGGER trigger_update_settlement
AFTER UPDATE ON public.manifests
FOR EACH ROW
WHEN (OLD.freight_value IS DISTINCT FROM NEW.freight_value)
EXECUTE FUNCTION public.update_settlement_on_manifest_change();

-- 4. Create function to remove settlement item when manifest is deleted
CREATE OR REPLACE FUNCTION public.remove_settlement_on_manifest_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_settlement_id UUID;
BEGIN
  -- Find the settlement for this manifest's items
  SELECT settlement_id INTO v_settlement_id
  FROM public.settlement_items
  WHERE manifest_id = OLD.id
  LIMIT 1;

  -- Delete settlement items for this manifest
  DELETE FROM public.settlement_items
  WHERE manifest_id = OLD.id;

  -- If we found a settlement, recalculate its totals
  IF v_settlement_id IS NOT NULL THEN
    UPDATE public.settlements
    SET 
      total_freight = (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.settlement_items
        WHERE settlement_id = v_settlement_id 
          AND item_type = 'freight' 
          AND is_deduction = false
      ),
      updated_at = pg_catalog.now()
    WHERE id = v_settlement_id;
  END IF;

  RETURN OLD;
END;
$$;

-- 5. Create trigger for manifest deletion
DROP TRIGGER IF EXISTS trigger_delete_settlement ON public.manifests;

CREATE TRIGGER trigger_delete_settlement
BEFORE DELETE ON public.manifests
FOR EACH ROW
EXECUTE FUNCTION public.remove_settlement_on_manifest_delete();