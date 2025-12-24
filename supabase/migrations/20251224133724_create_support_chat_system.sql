/*
  # Create Support Chat System

  1. New Tables
    - `support_messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `restaurant_id` (uuid, foreign key) - Business that message belongs to
      - `sender_type` (text) - Type of sender: BUSINESS or SUPPORT
      - `sender_id` (uuid) - ID of the user who sent the message
      - `message` (text) - The message content
      - `read` (boolean) - Whether message has been read
      - `created_at` (timestamptz) - When message was sent
      
  2. Security
    - Enable RLS on `support_messages` table
    - Business owners can view and create messages for their restaurant
    - Super admins can view and create messages for all restaurants
    - Messages are ordered by creation time for chat display
*/

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('BUSINESS', 'SUPPORT')),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_restaurant ON support_messages(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(restaurant_id, read) WHERE read = false;

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Business owners can view messages for their restaurant
CREATE POLICY "Business owners can view own messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Business owners can send messages for their restaurant
CREATE POLICY "Business owners can send messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'BUSINESS' AND
    sender_id = auth.uid() AND
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Super admins can view all messages
CREATE POLICY "Super admins can view all messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Super admins can send messages to any restaurant
CREATE POLICY "Super admins can send messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'SUPPORT' AND
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Business owners can mark their messages as read
CREATE POLICY "Business owners can update message read status"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Super admins can update any message
CREATE POLICY "Super admins can update messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );
