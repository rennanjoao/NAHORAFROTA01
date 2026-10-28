-- ============================================================================
-- SECURITY FIX: Tighten profiles table RLS policies
-- ============================================================================
-- Issue: profiles_broad_read
-- The "Profiles: Dono ou Admin" policy grants SELECT access to all profiles
-- for users with manager/owner roles, exposing email addresses unnecessarily.
-- ============================================================================

-- Step 1: Drop the overly broad legacy policy
DROP POLICY IF EXISTS "Profiles: Dono ou Admin" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Step 2: Keep existing proper policies:
-- - "Admins can view all profiles for user management" (admin-only SELECT) ✓
-- - "Users can insert own profile" (self INSERT) ✓
-- - "Users can update own profile" (self UPDATE) ✓
-- - "require_authenticated_profiles" (restrictive auth check) ✓

-- Step 3: Add a clear policy for users to view their own profile (if not already covered)
-- This ensures users can SELECT their own profile without the broad legacy policy
CREATE POLICY "users_view_own_profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Note: Fleet managers and dispatchers who need profile data (names, avatars)
-- should use the get_operational_profiles() SECURITY DEFINER function instead
-- of direct table access. This function returns only non-sensitive fields.