CREATE OR REPLACE FUNCTION public.delete_driver_complete(p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_driver_name text;
BEGIN
  SELECT name INTO v_driver_name
  FROM public.drivers
  WHERE id = p_driver_id;

  IF v_driver_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Motorista nao encontrado.');
  END IF;

  -- Storage files are removed by the Storage API from the frontend when needed.
  -- SQL cannot delete directly from storage.objects in hosted Supabase.
  DELETE FROM public.driver_documents
  WHERE driver_id = p_driver_id;

  DELETE FROM public.fleet_positions
  WHERE driver_id = p_driver_id;

  DELETE FROM public.driver_activity_logs
  WHERE driver_id = p_driver_id;

  DELETE FROM public.driver_wallet
  WHERE driver_id = p_driver_id;

  UPDATE public.company_vehicles
  SET
    current_driver_id = NULL,
    current_driver_name = NULL,
    status = CASE WHEN status = 'in_use' THEN 'available' ELSE status END,
    updated_at = now()
  WHERE current_driver_id = p_driver_id;

  UPDATE public.invoices
  SET
    driver_id = NULL,
    updated_at = now()
  WHERE driver_id = p_driver_id;

  UPDATE public.delivery_proofs
  SET driver_id = NULL
  WHERE driver_id = p_driver_id;

  UPDATE public.driver_occurrences
  SET driver_id = NULL
  WHERE driver_id = p_driver_id;

  UPDATE public.deliveries
  SET driver_id = NULL
  WHERE driver_id = p_driver_id;

  UPDATE public.delivery_occurrences
  SET driver_id = NULL
  WHERE driver_id = p_driver_id;

  UPDATE public.manifests
  SET
    driver_id = NULL,
    updated_at = now()
  WHERE driver_id = p_driver_id;

  DELETE FROM public.drivers
  WHERE id = p_driver_id;

  RETURN json_build_object('success', true, 'message', 'Motorista removido com sucesso.', 'driver_name', v_driver_name);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_driver_complete(uuid) TO authenticated;
