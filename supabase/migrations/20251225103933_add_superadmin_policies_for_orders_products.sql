/*
  # Add Superadmin Policies for Orders and Products

  1. Problem
    - Superadmins cannot view all orders and products for sales reporting
    - Current policies only allow business owners to see their own data
    - SuperAdmin dashboard needs to aggregate data across all businesses

  2. Changes
    - Add SELECT policy for orders allowing superadmins to view all orders
    - Add SELECT policy for products allowing superadmins to view all products
    - These policies work alongside existing business owner policies

  3. Security
    - Only users with SUPER_ADMIN role can access all data
    - Business owners still only see their own data through existing policies
*/

-- Add superadmin policy for orders
CREATE POLICY "Superadmins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Add superadmin policy for products  
CREATE POLICY "Superadmins can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );
