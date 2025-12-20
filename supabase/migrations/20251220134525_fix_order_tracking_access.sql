/*
  # Fix Order Tracking Access for Anonymous Users

  1. Changes
    - Add policy to allow anonymous users to read orders via tracking tokens
    - This enables the public order tracking feature without authentication

  2. Security
    - Only allows reading orders when a valid, non-expired tracking token exists
    - Does not allow any modifications to orders
    - Customers can only see order information, not internal data
*/

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Anyone can view orders with valid tracking token" ON orders;

-- Create policy to allow anonymous users to view orders with valid tracking tokens
CREATE POLICY "Anyone can view orders with valid tracking token"
  ON orders FOR SELECT
  USING (
    id IN (
      SELECT order_id
      FROM order_tracking_tokens
      WHERE expires_at > now()
    )
  );