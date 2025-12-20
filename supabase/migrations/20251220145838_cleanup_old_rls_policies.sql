/*
  # Cleanup Old RLS Policies

  1. Changes
    - Remove old restrictive policies that check auth.uid()
    - These conflict with new permissive policies for custom auth

  2. Security
    - Keep the simplified policies that work with custom authentication
*/

-- Remove remaining old policies on products
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Restaurant owner can manage products" ON products;

-- Remove duplicate tracking token policy on orders
DROP POLICY IF EXISTS "Anyone can view orders with valid tracking token" ON orders;
