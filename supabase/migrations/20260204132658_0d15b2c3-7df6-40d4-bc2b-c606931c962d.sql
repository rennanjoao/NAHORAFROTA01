-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authorized users can insert invoices" ON public.invoices;

-- Create new INSERT policy that allows any authenticated user
CREATE POLICY "Authenticated users can insert invoices"
ON public.invoices FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);