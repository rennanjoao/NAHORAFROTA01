-- ============================================================================
-- SECURITY FIX: Harden views and create masked invoice view for drivers
-- ============================================================================
-- Issues fixed:
-- 1. drivers_table_sensitive_exposure - Update vw_drivers_operational with security_barrier
-- 2. invoices_customer_data_exposure - Create masked view for driver access
-- ============================================================================

-- ============================================================================
-- FIX 1: Update vw_drivers_operational with security settings
-- This view already excludes sensitive data, adding security_barrier/invoker
-- ============================================================================
DROP VIEW IF EXISTS public.vw_drivers_operational;

CREATE VIEW public.vw_drivers_operational
WITH (security_barrier = true, security_invoker = true)
AS SELECT 
    id,
    name,
    avatar,
    photo_url,
    vehicle_plate,
    vehicle_type,
    status,
    current_delay,
    individual_sla,
    daily_sla,
    deliveries_completed,
    total_deliveries,
    is_own_fleet,
    finished_time,
    last_gps_update,
    gps_signal_status,
    created_at,
    updated_at
FROM public.drivers;

-- Grant SELECT to authenticated users (RLS from underlying table applies)
GRANT SELECT ON public.vw_drivers_operational TO authenticated;

-- ============================================================================
-- FIX 2: Update vw_drivers_with_gps_status with security settings
-- Exclude phone number for non-admin access
-- ============================================================================
DROP VIEW IF EXISTS public.vw_drivers_with_gps_status;

CREATE VIEW public.vw_drivers_with_gps_status
WITH (security_barrier = true, security_invoker = true)
AS SELECT 
    d.id,
    d.name,
    -- Phone only visible to admins/fleet_managers, masked for others
    CASE 
        WHEN public.has_role(auth.uid(), 'admin'::public.app_role) 
             OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
             OR d.user_id = auth.uid()
        THEN d.phone
        ELSE NULL
    END AS phone,
    d.photo_url,
    d.vehicle_plate,
    d.vehicle_type,
    d.status,
    d.gps_signal_status,
    d.last_gps_update,
    fp.latitude,
    fp.longitude,
    fp.speed,
    fp.battery_level,
    CASE
        WHEN ((fp.last_update > (now() - '00:05:00'::interval)) AND (fp.is_active = true)) THEN 'online'::text
        WHEN (fp.last_update > (now() - '00:30:00'::interval)) THEN 'idle'::text
        ELSE 'offline'::text
    END AS computed_gps_status
FROM public.drivers d
LEFT JOIN public.fleet_positions fp ON (d.id = fp.driver_id);

GRANT SELECT ON public.vw_drivers_with_gps_status TO authenticated;

-- ============================================================================
-- FIX 3: Create secure invoice view for drivers with masked customer data
-- Drivers only need delivery info, not customer contact details for harvesting
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_invoices_for_drivers
WITH (security_barrier = true, security_invoker = true)
AS SELECT 
    i.id,
    i.access_key,
    i.nfe_number,
    i.recipient_name,
    -- Mask full address, show only city/state for navigation context
    i.address_city,
    i.address_state,
    i.address_neighborhood,
    -- Include coordinates for navigation (required for delivery)
    i.latitude,
    i.longitude,
    -- Status and delivery info
    i.status,
    i.total_value,
    i.total_weight,
    i.volume_quantity,
    i.manifest_id,
    i.driver_id,
    i.delivered_at,
    i.occurrence_type,
    i.observation,
    i.receiver_name,
    i.imported_at,
    i.updated_at,
    i.regiao_logistica
    -- EXCLUDED: recipient_phone, receiver_document, address_full, address_street, address_number, address_zip
FROM public.invoices i
WHERE EXISTS (
    SELECT 1 FROM public.manifests m
    JOIN public.drivers d ON d.id = m.driver_id
    WHERE m.id = i.manifest_id 
    AND d.user_id = auth.uid()
);

GRANT SELECT ON public.vw_invoices_for_drivers TO authenticated;

-- ============================================================================
-- FIX 4: Create function for drivers to get invoice delivery address only when needed
-- This provides address at delivery time via RPC, not exposed in bulk queries
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_invoice_delivery_address(p_invoice_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_driver_id UUID;
    v_invoice RECORD;
BEGIN
    -- Get driver_id for current user
    SELECT id INTO v_driver_id
    FROM public.drivers
    WHERE user_id = auth.uid();
    
    IF v_driver_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Driver not found');
    END IF;
    
    -- Verify this invoice belongs to driver's manifest
    SELECT i.id, i.address_full, i.address_street, i.address_number, 
           i.address_neighborhood, i.address_city, i.address_state, 
           i.address_zip, i.latitude, i.longitude, i.recipient_name
    INTO v_invoice
    FROM public.invoices i
    JOIN public.manifests m ON m.id = i.manifest_id
    WHERE i.id = p_invoice_id
    AND m.driver_id = v_driver_id
    AND m.status IN ('pending', 'in_progress', 'active', 'assigned');
    
    IF v_invoice.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found or not assigned to you');
    END IF;
    
    -- Return address info for active delivery
    RETURN json_build_object(
        'success', true,
        'address_full', v_invoice.address_full,
        'address_street', v_invoice.address_street,
        'address_number', v_invoice.address_number,
        'address_neighborhood', v_invoice.address_neighborhood,
        'address_city', v_invoice.address_city,
        'address_state', v_invoice.address_state,
        'address_zip', v_invoice.address_zip,
        'latitude', v_invoice.latitude,
        'longitude', v_invoice.longitude,
        'recipient_name', v_invoice.recipient_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_delivery_address(UUID) TO authenticated;