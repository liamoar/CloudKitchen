/*
  # Fix RLS Policies to Use auth_id

  1. Problem
    - RLS policies are checking users.id = auth.uid()
    - auth.uid() returns the Supabase Auth UUID (auth_id column)
    - Should check users.auth_id = auth.uid() instead

  2. Changes
    - Drop and recreate superadmin policies to use auth_id
    - Fix policies on: businesses, orders, products, payment_invoices

  3. Security
    - Maintains proper access control
    - Superadmins can view all data using auth_id matching
*/

-- Drop existing superadmin policies
DROP POLICY IF EXISTS "Superadmins can view all businesses" ON businesses;
DROP POLICY IF EXISTS "Superadmins can manage all businesses" ON businesses;
DROP POLICY IF EXISTS "Superadmins can view all orders" ON orders;
DROP POLICY IF EXISTS "Superadmins can view all products" ON products;

-- Recreate businesses policies with auth_id
CREATE POLICY "Superadmins can view all businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Superadmins can manage all businesses"
  ON businesses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Recreate orders policy with auth_id
CREATE POLICY "Superadmins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Recreate products policy with auth_id
CREATE POLICY "Superadmins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );
