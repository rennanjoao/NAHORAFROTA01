-- ============================================================================
-- SECURITY FIX: Block Anonymous Access to Sensitive Tables
-- ============================================================================
-- Issue: Tables are publicly readable because deny_anonymous policies are PERMISSIVE
-- Fix: Convert to RESTRICTIVE policies and revoke anon SELECT permissions
-- ============================================================================

-- Step 1: Revoke SELECT permission from anon role on sensitive tables
-- This is a belt-and-suspenders approach - even with RLS, we don't want anon to query

REVOKE SELECT ON public.delivery_proofs FROM anon;
REVOKE SELECT ON public.fleet_positions FROM anon;
REVOKE SELECT ON public.invoices FROM anon;
REVOKE SELECT ON public.manifests FROM anon;
REVOKE SELECT ON public.settlements FROM anon;
REVOKE SELECT ON public.settlement_items FROM anon;

-- Step 2: Drop the old PERMISSIVE deny_anonymous policies
DROP POLICY IF EXISTS "deny_anonymous_delivery_proofs" ON public.delivery_proofs;
DROP POLICY IF EXISTS "deny_anonymous_fleet_positions" ON public.fleet_positions;
DROP POLICY IF EXISTS "deny_anonymous_invoices" ON public.invoices;
DROP POLICY IF EXISTS "deny_anonymous_manifests" ON public.manifests;
DROP POLICY IF EXISTS "deny_anonymous_settlements" ON public.settlements;
DROP POLICY IF EXISTS "deny_anonymous_settlement_items" ON public.settlement_items;

-- Step 3: Create RESTRICTIVE policies that block anonymous access
-- RESTRICTIVE policies use AND logic - they MUST pass alongside any permissive policies

CREATE POLICY "require_authenticated_delivery_proofs"
  ON public.delivery_proofs
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "require_authenticated_fleet_positions"
  ON public.fleet_positions
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "require_authenticated_invoices"
  ON public.invoices
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "require_authenticated_manifests"
  ON public.manifests
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "require_authenticated_settlements"
  ON public.settlements
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "require_authenticated_settlement_items"
  ON public.settlement_items
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- Also ensure drivers table has RESTRICTIVE policy (currently only has PERMISSIVE)
-- ============================================================================

DROP POLICY IF EXISTS "deny_anonymous_drivers" ON public.drivers;

CREATE POLICY "require_authenticated_drivers"
  ON public.drivers
  AS RESTRICTIVE
  FOR ALL
  USING (auth.role() = 'authenticated');