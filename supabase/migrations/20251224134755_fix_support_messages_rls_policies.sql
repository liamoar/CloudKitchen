/*
  # Fix Support Messages RLS Policies for Supabase Auth

  1. Changes
    - Drop existing RLS policies for support_messages
    - Recreate policies that properly check auth_id in users table
    - Ensure business owners can send and view messages using Supabase Auth
    - Ensure super admins can manage all messages

  2. Security
    - Policies now properly join users table to check auth_id against auth.uid()
    - Business messages restricted to authenticated restaurant owners
    - Support messages restricted to super admins only
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Business owners can view own messages" ON support_messages;
DROP POLICY IF EXISTS "Business owners can send messages" ON support_messages;
DROP POLICY IF EXISTS "Super admins can view all messages" ON support_messages;
DROP POLICY IF EXISTS "Super admins can send messages" ON support_messages;
DROP POLICY IF EXISTS "Business owners can update message read status" ON support_messages;
DROP POLICY IF EXISTS "Super admins can update messages" ON support_messages;

-- Business owners can view messages for their restaurant
CREATE POLICY "Business owners can view own messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT r.id 
      FROM restaurants r
      INNER JOIN users u ON r.owner_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Business owners can send messages for their restaurant
CREATE POLICY "Business owners can send messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'BUSINESS' AND
    sender_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    ) AND
    restaurant_id IN (
      SELECT r.id 
      FROM restaurants r
      INNER JOIN users u ON r.owner_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Business owners can mark messages as read for their restaurant
CREATE POLICY "Business owners can update message read status"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT r.id 
      FROM restaurants r
      INNER JOIN users u ON r.owner_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT r.id 
      FROM restaurants r
      INNER JOIN users u ON r.owner_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Super admins can view all messages
CREATE POLICY "Super admins can view all messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Super admins can send messages to any restaurant
CREATE POLICY "Super admins can send messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'SUPPORT' AND
    sender_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Super admins can update any message
CREATE POLICY "Super admins can update messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );
