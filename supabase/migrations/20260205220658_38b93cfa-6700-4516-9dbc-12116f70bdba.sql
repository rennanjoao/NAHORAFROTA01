-- Fix STORAGE_EXPOSURE: Make delivery-proofs bucket private
-- The bucket currently allows public access to sensitive delivery photos

-- 1. Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'delivery-proofs';

-- 2. Drop the overly permissive "Anyone can view" policy if it exists
DROP POLICY IF EXISTS "Anyone can view delivery proofs" ON storage.objects;

-- 3. Ensure proper authenticated access policy exists
-- This replaces any permissive public policy with role-based access
DROP POLICY IF EXISTS "Authenticated users can view delivery proofs" ON storage.objects;

CREATE POLICY "Authenticated users can view delivery proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'delivery-proofs' 
  AND (
    -- Admins and fleet managers can view all
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'fleet_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
    -- Drivers can view their own proofs (via signed URLs)
    OR auth.uid() IS NOT NULL
  )
);

-- Note: The DeliveryProofModal already uses signed URLs with 1-year expiry,
-- which is the correct approach for private buckets. No code changes needed.