-- Fix update_updated_at_column function to use empty search_path for security
-- This prevents schema injection attacks

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';