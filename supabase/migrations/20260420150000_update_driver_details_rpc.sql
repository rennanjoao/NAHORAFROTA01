CREATE OR REPLACE FUNCTION public.update_driver_details(p_driver jsonb)
RETURNS public.drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_tenant_id uuid;
  v_result public.drivers;
BEGIN
  v_driver_id := (p_driver->>'id')::uuid;
  v_tenant_id := public.get_user_tenant_id(auth.uid());

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'ID do motorista e obrigatorio';
  END IF;

  IF NOT (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para esta tarefa';
  END IF;

  UPDATE public.drivers
  SET
    name = COALESCE(NULLIF(p_driver->>'name', ''), name),
    cpf = COALESCE(p_driver->>'cpf', cpf),
    phone = COALESCE(p_driver->>'phone', phone),
    avatar = COALESCE(p_driver->>'avatar', avatar),
    photo = COALESCE(p_driver->>'photo', photo),
    vehicle_plate = COALESCE(p_driver->>'vehicle_plate', vehicle_plate),
    vehicle_type = COALESCE(p_driver->>'vehicle_type', vehicle_type),
    status = COALESCE(p_driver->>'status', status),
    is_own_fleet = COALESCE((p_driver->>'is_own_fleet')::boolean, is_own_fleet),
    banco = CASE WHEN p_driver ? 'banco' THEN NULLIF(p_driver->>'banco', '') ELSE banco END,
    agencia = CASE WHEN p_driver ? 'agencia' THEN NULLIF(p_driver->>'agencia', '') ELSE agencia END,
    conta = CASE WHEN p_driver ? 'conta' THEN NULLIF(p_driver->>'conta', '') ELSE conta END,
    tipo_conta = CASE WHEN p_driver ? 'tipo_conta' THEN NULLIF(p_driver->>'tipo_conta', '') ELSE tipo_conta END,
    chave_pix = CASE WHEN p_driver ? 'chave_pix' THEN NULLIF(p_driver->>'chave_pix', '') ELSE chave_pix END,
    updated_at = now()
  WHERE id = v_driver_id
    AND (
      public.is_platform_admin(auth.uid())
      OR tenant_id = v_tenant_id
    )
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Motorista nao encontrado ou fora do tenant do usuario';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_driver_details(jsonb) TO authenticated;
