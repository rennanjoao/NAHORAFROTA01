-- Função RPC transacional para criar romaneio de forma atômica
-- Se qualquer etapa falhar, toda a operação é revertida automaticamente
CREATE OR REPLACE FUNCTION public.create_manifest_with_invoices(
  p_driver_id UUID,
  p_driver_name TEXT,
  p_driver_cpf TEXT DEFAULT NULL,
  p_vehicle_plate TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT NULL,
  p_is_own_fleet BOOLEAN DEFAULT FALSE,
  p_company_vehicle_id UUID DEFAULT NULL,
  p_freight_type TEXT DEFAULT 'fixed',
  p_freight_value NUMERIC DEFAULT 0,
  p_per_km_value NUMERIC DEFAULT NULL,
  p_estimated_distance NUMERIC DEFAULT NULL,
  p_scheduled_date DATE DEFAULT CURRENT_DATE,
  p_observation TEXT DEFAULT NULL,
  p_invoice_ids UUID[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_manifest_id UUID;
  v_manifest_code TEXT;
  v_total_value NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_invoices_count INTEGER := 0;
  v_updated_count INTEGER;
BEGIN
  -- Gerar código único do romaneio
  v_manifest_code := 'ROM-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  
  -- ETAPA 1: Criar o romaneio
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
  RETURNING id INTO v_manifest_id;
  
  -- Verificar se o romaneio foi criado
  IF v_manifest_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao criar registro do romaneio';
  END IF;
  
  -- ETAPA 2: Calcular totais das NFs selecionadas
  SELECT 
    COALESCE(SUM(total_value), 0),
    COALESCE(SUM(total_weight), 0),
    COUNT(*)
  INTO v_total_value, v_total_weight, v_invoices_count
  FROM public.invoices
  WHERE id = ANY(p_invoice_ids);
  
  -- ETAPA 3: Atualizar as NFs vinculando ao romaneio
  UPDATE public.invoices
  SET 
    manifest_id = v_manifest_id,
    driver_id = p_driver_id,
    status = 'in_transit',
    updated_at = pg_catalog.now()
  WHERE id = ANY(p_invoice_ids)
    AND (manifest_id IS NULL OR status = 'pending');
  
  -- Verificar quantas NFs foram realmente atualizadas
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Se nenhuma NF foi atualizada (já estavam vinculadas), reverter tudo
  IF v_updated_count = 0 AND array_length(p_invoice_ids, 1) > 0 THEN
    RAISE EXCEPTION 'Nenhuma NF válida para vincular. As notas já podem estar em outro romaneio.';
  END IF;
  
  -- ETAPA 4: Atualizar totais no romaneio
  UPDATE public.manifests
  SET 
    total_value = v_total_value,
    total_weight = v_total_weight,
    deliveries_count = v_updated_count
  WHERE id = v_manifest_id;
  
  -- Retornar sucesso com dados do romaneio criado
  RETURN json_build_object(
    'success', true,
    'manifest_id', v_manifest_id,
    'manifest_code', v_manifest_code,
    'invoices_linked', v_updated_count,
    'total_value', v_total_value,
    'total_weight', v_total_weight,
    'message', 'Romaneio criado com sucesso!'
  );

EXCEPTION WHEN OTHERS THEN
  -- Em caso de qualquer erro, a transação é automaticamente revertida
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Erro ao gerar romaneio. As notas não foram alteradas.'
  );
END;
$function$;

-- Comentário explicativo
COMMENT ON FUNCTION public.create_manifest_with_invoices IS 
'Cria um romaneio e vincula as NFs de forma atômica (transacional). 
Se qualquer etapa falhar, toda a operação é revertida automaticamente,
evitando NFs órfãs (bloqueadas sem romaneio).';
