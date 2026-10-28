-- Atualiza a função RPC para também atualizar o status do motorista para 'in_route'
-- quando um romaneio é criado, garantindo que ele não apareça na lista de disponíveis

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
  
  -- STEP 2: Update driver status to 'in_route' to prevent duplicate manifests
  UPDATE public.drivers
  SET 
    status = 'in_route',
    updated_at = pg_catalog.now()
  WHERE id = p_driver_id;
  
  -- STEP 3: Update company vehicle status to 'in_use' if using own fleet
  IF p_company_vehicle_id IS NOT NULL THEN
    UPDATE public.company_vehicles
    SET 
      status = 'in_use',
      current_driver_id = p_driver_id,
      current_driver_name = p_driver_name,
      updated_at = pg_catalog.now()
    WHERE id = p_company_vehicle_id;
  END IF;
  
  -- STEP 4: Calculate totals from selected invoices
  SELECT 
    COALESCE(SUM(total_value), 0),
    COALESCE(SUM(total_weight), 0),
    COUNT(*)
  INTO v_total_value, v_total_weight, v_invoices_count
  FROM public.invoices
  WHERE id = ANY(p_invoice_ids);
  
  -- STEP 5: Update invoices linking to manifest
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
  
  -- STEP 6: Update manifest totals
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

-- Comentário explicativo atualizado
COMMENT ON FUNCTION public.create_manifest_with_invoices IS 
'Cria um romaneio e vincula as NFs de forma atômica (transacional). 
Também atualiza o status do motorista para "in_route" para evitar duplicidade.
Se qualquer etapa falhar, toda a operação é revertida automaticamente,
garantindo integridade dos dados.';