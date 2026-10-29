-- Acerto do frete quando NFs saem do romaneio com ocorrencia (resposta do usuario, 29/10/2026):
--   frete por entrega (freight_type 'fixed', valor por NF): paga so as NFs que ficaram;
--   frete fechado (por saida, 'lumpsum') e por km ('per_km'): paga o valor cheio.
-- Antes o romaneio finalizava com o frete da quantidade original: 6 x R$ 25,50 com so
-- 4 NFs entregues. A linha da carteira (driver_wallet) acompanha sozinha pelo gatilho
-- trg_sync_driver_wallet_freight, que dispara na mudanca de freight_value.
CREATE OR REPLACE FUNCTION public.finalize_manifest(p_manifest_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_manifest public.manifests%ROWTYPE;
  v_open integer;
  v_delivered integer;
  v_returned integer;
  v_kept integer;
  v_new_freight numeric;
BEGIN
  SELECT * INTO v_manifest
  FROM public.manifests
  WHERE id = p_manifest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Romaneio nao encontrado.');
  END IF;

  IF NOT (public.can_manage_tenant(v_manifest.tenant_id, auth.uid()) OR public.is_platform_admin(auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Sem permissao para finalizar este romaneio.');
  END IF;

  IF v_manifest.status IN ('paid', 'cancelled') THEN
    RETURN json_build_object('success', false, 'error',
      CASE WHEN v_manifest.status = 'paid' THEN 'Romaneio ja pago no acerto.' ELSE 'Romaneio cancelado.' END);
  END IF;

  IF v_manifest.status = 'completed' THEN
    RETURN json_build_object('success', true, 'already_completed', true);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('pending', 'in_transit', 'delayed', 'returning')),
    COUNT(*) FILTER (WHERE status = 'delivered')
  INTO v_open, v_delivered
  FROM public.invoices
  WHERE manifest_id = p_manifest_id;

  IF v_open > 0 THEN
    RETURN json_build_object('success', false, 'error',
      v_open || ' NF(s) ainda em rota. Registre a entrega ou a ocorrencia antes de finalizar.',
      'open_count', v_open);
  END IF;

  -- NFs com ocorrencia voltam para a roteirizacao como "Devolvido".
  WITH returned AS (
    UPDATE public.invoices
    SET status = 'returned',
        manifest_id = NULL,
        driver_id = NULL,
        route_sequence = NULL,
        updated_at = now()
    WHERE manifest_id = p_manifest_id
      AND status IN ('occurrence', 'returned')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_returned FROM returned;

  -- Frete "fixo" e por NF (por entrega): paga so as NFs que ficaram no romaneio.
  -- Frete fechado (por saida) e por km nao mudam: o motorista saiu e rodou do mesmo jeito.
  v_new_freight := v_manifest.freight_value;
  IF v_returned > 0
     AND v_manifest.freight_type = 'fixed'
     AND NOT COALESCE(v_manifest.is_own_fleet, false)
     AND COALESCE(v_manifest.deliveries_count, 0) > 0
  THEN
    SELECT COUNT(*) INTO v_kept FROM public.invoices WHERE manifest_id = p_manifest_id;
    v_new_freight := round(COALESCE(v_manifest.freight_value, 0) / v_manifest.deliveries_count * v_kept, 2);
  END IF;

  UPDATE public.manifests
  SET status = 'completed',
      had_occurrence = had_occurrence OR v_returned > 0,
      freight_value = v_new_freight,
      -- Mesma conta do painel (recalculateManifestTotals): so as NFs que ficaram.
      deliveries_count = CASE WHEN v_returned > 0 THEN (SELECT COUNT(*) FROM public.invoices WHERE manifest_id = p_manifest_id) ELSE deliveries_count END,
      total_value = CASE WHEN v_returned > 0 THEN (SELECT COALESCE(SUM(total_value), 0) FROM public.invoices WHERE manifest_id = p_manifest_id) ELSE total_value END,
      total_weight = CASE WHEN v_returned > 0 THEN (SELECT COALESCE(SUM(total_weight), 0) FROM public.invoices WHERE manifest_id = p_manifest_id) ELSE total_weight END,
      updated_at = now()
  WHERE id = p_manifest_id;

  IF v_manifest.driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.driver_id = v_manifest.driver_id
      AND m.id <> p_manifest_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.drivers
    SET status = 'active', updated_at = now()
    WHERE id = v_manifest.driver_id
      AND status = 'in_route';
  END IF;

  IF v_manifest.company_vehicle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.manifests m
    WHERE m.company_vehicle_id = v_manifest.company_vehicle_id
      AND m.id <> p_manifest_id
      AND m.status NOT IN ('completed', 'paid', 'cancelled')
  ) THEN
    UPDATE public.company_vehicles
    SET status = 'available', updated_at = now()
    WHERE id = v_manifest.company_vehicle_id;
  END IF;

  RETURN json_build_object('success', true, 'delivered_count', v_delivered, 'returned_count', v_returned, 'freight_value', v_new_freight);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_manifest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_manifest(uuid) TO authenticated, service_role;
