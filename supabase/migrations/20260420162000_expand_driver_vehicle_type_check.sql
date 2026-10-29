-- Allow the driver screen to persist the same vehicle types it displays.
ALTER TABLE public.drivers
DROP CONSTRAINT IF EXISTS drivers_vehicle_type_check;

UPDATE public.drivers
SET vehicle_type = lower(vehicle_type)
WHERE vehicle_type IS NOT NULL;

ALTER TABLE public.drivers
ADD CONSTRAINT drivers_vehicle_type_check
CHECK (
  vehicle_type IN (
    'fiorino',
    'vuc',
    'toco',
    'truck',
    'carreta',
    'van',
    'moto'
  )
);
