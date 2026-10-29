-- 1. Add sequential manifest number with year format
ALTER TABLE public.manifests 
ADD COLUMN IF NOT EXISTS manifest_number INTEGER;

-- 2. Create sequence for manifest numbers (resets yearly concept handled in trigger)
CREATE SEQUENCE IF NOT EXISTS manifest_number_seq START 1;

-- 3. Populate existing manifests with sequential numbers based on creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.manifests
  WHERE manifest_number IS NULL
)
UPDATE public.manifests m
SET manifest_number = n.rn
FROM numbered n
WHERE m.id = n.id;

-- 4. Create function to auto-generate manifest number on insert
CREATE OR REPLACE FUNCTION public.set_manifest_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the next number for this year
  SELECT COALESCE(MAX(manifest_number), 0) + 1 INTO next_number
  FROM public.manifests
  WHERE EXTRACT(YEAR FROM created_at) = current_year;
  
  NEW.manifest_number := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-set manifest number
DROP TRIGGER IF EXISTS trigger_set_manifest_number ON public.manifests;
CREATE TRIGGER trigger_set_manifest_number
  BEFORE INSERT ON public.manifests
  FOR EACH ROW
  WHEN (NEW.manifest_number IS NULL)
  EXECUTE FUNCTION public.set_manifest_number();

-- 6. Add index for fast lookups by manifest_number
CREATE INDEX IF NOT EXISTS idx_manifests_number ON public.manifests(manifest_number);

-- 7. Update manifest_audit_logs to ensure performed_by_name is populated
-- Add column if not exists for user full name
ALTER TABLE public.manifest_audit_logs
ADD COLUMN IF NOT EXISTS user_full_name TEXT;

-- 8. Create function to get user full name from profiles
CREATE OR REPLACE FUNCTION public.get_user_full_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  full_name TEXT;
BEGIN
  SELECT name INTO full_name
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN COALESCE(full_name, 'Sistema');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 9. Update create_manifest_with_invoices to include manifest_number in response
CREATE OR REPLACE FUNCTION public.create_manifest_with_invoices(
  p_driver_id uuid, 
  p_driver_name text, 
  p_driver_cpf text DEFAULT NULL::text, 
  p_vehicle_plate text DEFAULT NULL::text, 
  p_vehicle_type text DEFAULT NULL::text, 
  p_is_own_fleet boolean DEFAULT false, 
  p_company_vehicle_id uuid DEFAULT NULL::uuid, 
  p_freight_type text DEFAULT 'fixed'::text, 
  p_freight_value numeric DEFAULT 0, 
  p_per_km_value numeric DEFAULT NULL::numeric, 
  p_estimated_distance numeric DEFAULT NULL::numeric, 
  p_scheduled_date date DEFAULT CURRENT_DATE, 
  p_observation text DEFAULT NULL::text, 
  p_invoice_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_manifest_id UUID;
  v_manifest_code TEXT;
  v_manifest_number INTEGER;
  v_total_value NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_invoices_count INTEGER := 0;
  v_updated_count INTEGER;
BEGIN
  -- Generate unique manifest code
  v_manifest_code := 'ROM-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  
  -- STEP 1: Create the manifest (manifest_number will be auto-set by trigger)
  INSERT INTO public.manifests (
    manifest_code,
    driver_id,
    driver_name,
    driver_cpf,
    vehicle_plate,
    vehicle_type,
    is_own_fleet,
    company_vehicle_id,
    freight_type,
    freight_value,
    per_km_value,
    estimated_distance,
    deliveries_count,
    scheduled_date,
    observation,
    status
  ) VALUES (
    v_manifest_code,
    p_driver_id,
    p_driver_name,
    p_driver_cpf,
    p_vehicle_plate,
    p_vehicle_type,
    p_is_own_fleet,
    p_company_vehicle_id,
    p_freight_type,
    p_freight_value,
    p_per_km_value,
    p_estimated_distance,
    array_length(p_invoice_ids, 1),
    p_scheduled_date,
    p_observation,
    'pending'
  )
  RETURNING id, manifest_number INTO v_manifest_id, v_manifest_number;
  
  IF v_manifest_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao criar registro do romaneio';
  END IF;
  
  -- STEP 2: Calculate totals from selected invoices
  SELECT 
    COALESCE(SUM(total_value), 0),
    COALESCE(SUM(total_weight), 0),
    COUNT(*)
  INTO v_total_value, v_total_weight, v_invoices_count
  FROM public.invoices
  WHERE id = ANY(p_invoice_ids);
  
  -- STEP 3: Update invoices linking to manifest
  UPDATE public.invoices
  SET 
    manifest_id = v_manifest_id,
    driver_id = p_driver_id,
    status = 'in_transit',
    updated_at = pg_catalog.now()
  WHERE id = ANY(p_invoice_ids)
    AND (manifest_id IS NULL OR status = 'pending');
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 AND array_length(p_invoice_ids, 1) > 0 THEN
    RAISE EXCEPTION 'Nenhuma NF válida para vincular. As notas já podem estar em outro romaneio.';
  END IF;
  
  -- STEP 4: Update manifest totals
  UPDATE public.manifests
  SET 
    total_value = v_total_value,
    total_weight = v_total_weight,
    deliveries_count = v_updated_count
  WHERE id = v_manifest_id;
  
  -- Return success with manifest data including the new sequential number
  RETURN json_build_object(
    'success', true,
    'manifest_id', v_manifest_id,
    'manifest_code', v_manifest_code,
    'manifest_number', v_manifest_number,
    'invoices_linked', v_updated_count,
    'total_value', v_total_value,
    'total_weight', v_total_weight,
    'message', 'Romaneio criado com sucesso!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Erro ao gerar romaneio. As notas não foram alteradas.'
  );
END;
$$;