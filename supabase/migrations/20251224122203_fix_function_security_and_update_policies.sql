/*
  # Fix Security Issues

  1. Security Fixes
    - Fix `get_restaurant_currency` function search_path security issue
    - Add missing UPDATE policy for subscription_tiers
    - Add missing UPDATE policy for subscription_configs (if needed)

  2. Changes
    - Set explicit search_path on SECURITY DEFINER function
    - Create UPDATE policies for super admin tier management
*/

-- Fix function search_path security issue
CREATE OR REPLACE FUNCTION public.get_restaurant_currency(restaurant_id_param uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restaurant_currency_result text;
BEGIN
  SELECT st.currency INTO restaurant_currency_result
  FROM restaurants r
  JOIN subscription_tiers st ON r.tier_id = st.id
  WHERE r.id = restaurant_id_param;

  RETURN COALESCE(restaurant_currency_result, 'USD');
END;
$$;

-- Drop the old ALL policy and create specific policies
DROP POLICY IF EXISTS "Super admin can manage subscription tiers" ON subscription_tiers;

-- Create specific policies for subscription_tiers
CREATE POLICY "Super admin can update subscription tiers"
  ON subscription_tiers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can insert subscription tiers"
  ON subscription_tiers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can delete subscription tiers"
  ON subscription_tiers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Add UPDATE policy for subscription_configs if it doesn't exist
DROP POLICY IF EXISTS "Super admin can manage subscription configs" ON subscription_configs;

CREATE POLICY "Super admin can update subscription configs"
  ON subscription_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can insert subscription configs"
  ON subscription_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admin can delete subscription configs"
  ON subscription_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );