-- Compatibility fixes for VehiclesPage/companyVehicleStore.
ALTER TABLE public.company_vehicles
ADD COLUMN IF NOT EXISTS renavam text;

CREATE UNIQUE INDEX IF NOT EXISTS company_vehicles_tenant_plate_unique
ON public.company_vehicles(tenant_id, upper(plate));
