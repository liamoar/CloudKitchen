/*
  # Fix Super Admin Policies to Use auth_id

  1. Problem
    - Policies checking `users.id = auth.uid()` but should check `users.auth_id = auth.uid()`
    - auth.uid() returns the auth table ID, not the users table ID
    - This causes authentication to fail for all policies

  2. Solution
    - Update subscription_tiers policies to use users.auth_id
    - Update subscription_configs policies to use users.auth_id

  3. Tables Fixed
    - subscription_tiers (UPDATE, INSERT, DELETE policies)
    - subscription_configs (UPDATE, INSERT, DELETE policies)
*/

-- ============================================
-- SUBSCRIPTION TIERS
-- ============================================

DROP POLICY IF EXISTS "Super admin can update subscription tiers" ON subscription_tiers;
DROP POLICY IF EXISTS "Super admin can insert subscription tiers" ON subscription_tiers;
DROP POLICY IF EXISTS "Super admin can delete subscription tiers" ON subscription_tiers;

CREATE POLICY "Super admin can update subscription tiers"
  ON subscription_tiers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can insert subscription tiers"
  ON subscription_tiers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can delete subscription tiers"
  ON subscription_tiers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- ============================================
-- SUBSCRIPTION CONFIGS
-- ============================================

DROP POLICY IF EXISTS "Super admin can update subscription configs" ON subscription_configs;
DROP POLICY IF EXISTS "Super admin can insert subscription configs" ON subscription_configs;
DROP POLICY IF EXISTS "Super admin can delete subscription configs" ON subscription_configs;

CREATE POLICY "Super admin can update subscription configs"
  ON subscription_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can insert subscription configs"
  ON subscription_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can delete subscription configs"
  ON subscription_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );