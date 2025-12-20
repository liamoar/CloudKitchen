/*
  # Extend Payment Receipts for Subscription Management

  1. Schema Changes
    - Add `subscription_tier_id` to payment_receipts (which tier they're paying for)
    - Add `transaction_type` to payment_receipts (upgrade or renewal)
    - Add `previous_tier_id` to track what tier they upgraded from
    
  2. Security
    - Update RLS policies to work with current_setting for custom auth
    - Allow restaurant owners to create and view their payment receipts
    - Allow super admins to view and update all payment receipts
*/

-- Add new columns to payment_receipts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_receipts' AND column_name = 'subscription_tier_id'
  ) THEN
    ALTER TABLE payment_receipts ADD COLUMN subscription_tier_id uuid REFERENCES subscription_tiers(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_receipts' AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE payment_receipts ADD COLUMN transaction_type text CHECK (transaction_type IN ('upgrade', 'renewal'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_receipts' AND column_name = 'previous_tier_id'
  ) THEN
    ALTER TABLE payment_receipts ADD COLUMN previous_tier_id uuid REFERENCES subscription_tiers(id);
  END IF;
END $$;

-- Drop old RLS policies if they exist
DROP POLICY IF EXISTS "Restaurant owners can create payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Restaurant owners can view own payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Super admins can view all payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Super admins can update payment receipts" ON payment_receipts;

-- Restaurant owners can insert their own payment receipts
CREATE POLICY "Restaurant owners can create payment receipts"
  ON payment_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = restaurant_id
      AND (
        restaurants.owner_id = auth.uid()
        OR current_setting('app.user_email', true) IN (
          SELECT email FROM users WHERE id = restaurants.owner_id
        )
      )
    )
  );

-- Restaurant owners can view their own payment receipts
CREATE POLICY "Restaurant owners can view own payment receipts"
  ON payment_receipts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = restaurant_id
      AND (
        restaurants.owner_id = auth.uid()
        OR current_setting('app.user_email', true) IN (
          SELECT email FROM users WHERE id = restaurants.owner_id
        )
      )
    )
  );

-- Super admins can view all payment receipts
CREATE POLICY "Super admins can view all payment receipts"
  ON payment_receipts
  FOR SELECT
  TO authenticated
  USING (
    current_setting('app.user_role', true) = 'super_admin'
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Super admins can update payment receipts (for approval/rejection)
CREATE POLICY "Super admins can update payment receipts"
  ON payment_receipts
  FOR UPDATE
  TO authenticated
  USING (
    current_setting('app.user_role', true) = 'super_admin'
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'super_admin'
    OR current_setting('app.user_role', true) = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'SUPER_ADMIN'
    )
  );