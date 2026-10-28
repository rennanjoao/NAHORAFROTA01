-- Fix storage bucket security: make delivery-proofs bucket private
-- and update policies to be restrictive

-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'delivery-proofs';

-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "Anyone can view delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create restrictive SELECT policies
-- Drivers can view files in their own folder (folder structure: {driver_id}/...)
CREATE POLICY "Drivers can view own delivery proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'delivery-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins and fleet managers can view all delivery proofs
CREATE POLICY "Admins and fleet managers can view all delivery proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'delivery-proofs' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'fleet_manager'::app_role))
);

-- Dispatchers can also view delivery proofs for operational purposes
CREATE POLICY "Dispatchers can view delivery proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'delivery-proofs' AND
  has_role(auth.uid(), 'dispatcher'::app_role)
);