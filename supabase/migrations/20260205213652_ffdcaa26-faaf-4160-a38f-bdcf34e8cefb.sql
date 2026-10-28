-- Fix error-level security findings: restrict operational SECURITY DEFINER functions and harden views to respect role checks

-- 1) Tighten get_operational_drivers() so it cannot be used to bypass RLS
CREATE OR REPLACE FUNCTION public.get_operational_drivers()
RETURNS TABLE(
  id uuid,
  name text,
  avatar text,
  vehicle_plate text,
  vehicle_type text,
  status text,
  current_delay integer,
  individual_sla numeric,
  daily_sla numeric,
  deliveries_completed integer,
  total_deliveries integer,
  is_own_fleet boolean,
  finished_time text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT 
    d.id,
    d.name,
    d.avatar,
    d.vehicle_plate,
    d.vehicle_type,
    d.status,
    d.current_delay,
    d.individual_sla,
    d.daily_sla,
    d.deliveries_completed,
    d.total_deliveries,
    d.is_own_fleet,
    d.finished_time,
    d.created_at,
    d.updated_at
  FROM public.drivers d
  WHERE
    -- Management roles can see all operational drivers
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
    -- Driver can only see their own row
    OR d.user_id = auth.uid()
$function$;

-- 2) Tighten get_operational_profiles() as well (same pattern)
CREATE OR REPLACE FUNCTION public.get_operational_profiles()
RETURNS TABLE(
  id uuid,
  name text,
  avatar_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.id, p.name, p.avatar_url, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
    OR p.id = auth.uid()
$function$;

-- 3) Remove dispatcher direct SELECT access to full drivers table (PII exposure)
DROP POLICY IF EXISTS "Dispatchers can view driver operational data" ON public.drivers;

-- 4) Harden operational views: ensure invoker behavior + explicit role filters
-- Note: RLS cannot be enabled on views; we enforce role checks in the view definitions.

CREATE OR REPLACE VIEW public.vw_drivers_with_gps_status
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  d.id,
  d.name,
  d.phone,
  d.vehicle_plate,
  d.vehicle_type,
  d.status,
  d.photo_url,
  d.gps_signal_status,
  d.last_gps_update,
  CASE
    WHEN (d.last_gps_update > (now() - '00:02:00'::interval)) THEN 'online'::text
    WHEN (d.last_gps_update > (now() - '00:05:00'::interval)) THEN 'weak'::text
    ELSE 'offline'::text
  END AS computed_gps_status,
  fp.latitude,
  fp.longitude,
  fp.speed,
  fp.battery_level
FROM public.drivers d
LEFT JOIN public.fleet_positions fp
  ON fp.driver_id = d.id
 AND fp.is_active = true
WHERE
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
  OR d.user_id = auth.uid();

CREATE OR REPLACE VIEW public.vw_occurrences_with_driver
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  o.id,
  o.driver_id,
  o.driver_name,
  o.type,
  o.title,
  o.description,
  o.severity,
  o.status,
  o.latitude,
  o.longitude,
  o.photos,
  o.resolved_by,
  o.resolved_at,
  o.created_at,
  o.updated_at,
  d.vehicle_plate,
  d.vehicle_type,
  d.phone AS driver_phone,
  d.photo_url AS driver_photo
FROM public.occurrences o
LEFT JOIN public.drivers d
  ON d.id = o.driver_id
WHERE
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
  OR d.user_id = auth.uid();

CREATE OR REPLACE VIEW public.vw_driver_occurrence_stats
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  o.driver_id,
  o.driver_name,
  count(*) AS total_occurrences,
  count(CASE WHEN o.status = 'open'::text THEN 1 ELSE NULL::integer END) AS open_count,
  count(CASE WHEN o.severity = 'critical'::text THEN 1 ELSE NULL::integer END) AS critical_count,
  max(o.created_at) AS last_occurrence_date
FROM public.occurrences o
LEFT JOIN public.drivers d
  ON d.id = o.driver_id
WHERE
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
  OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
  OR d.user_id = auth.uid()
GROUP BY o.driver_id, o.driver_name;