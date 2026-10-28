-- Fix DEFINER_OR_RPC_BYPASS: Update search_path from 'public' to empty string
-- This prevents potential schema injection attacks in SECURITY DEFINER functions

CREATE OR REPLACE FUNCTION public.get_operational_profiles()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''  -- Secure: empty search_path prevents schema injection
AS $$
  SELECT id, name, avatar_url, created_at, updated_at
  FROM public.profiles
$$;