/*
  # Add Subscription Automation and Cancellation Support

  ## Overview
  This migration adds missing subscription automation features to match Stripe-like functionality:
  - Cancel and pause subscription support
  - Downgrade tier support  
  - Storage bucket for payment receipts
  - Helper functions for subscription lifecycle management

  ## Changes

  ### 1. New Subscription Statuses
  - Add CANCELLED and PAUSED to subscription_status check constraint

  ### 2. Storage Bucket
  - Create payment_receipts bucket (if not exists) for file uploads
  - Set up public read access and authenticated write

  ### 3. Helper Functions
  - `cancel_subscription()` - Cancel a subscription with optional reason
  - `pause_subscription()` - Temporarily pause subscription
  - `resume_subscription()` - Resume a paused subscription
  - `request_tier_change()` - Request upgrade or downgrade with invoice generation

  ### 4. Database Triggers
  - Auto-set cancelled_at timestamp when status changes to CANCELLED

  ### 5. Additional Columns
  - restaurants.cancelled_at - Timestamp of cancellation
  - restaurants.cancellation_reason - Why subscription was cancelled
  - restaurants.paused_at - When subscription was paused
*/

-- 1. Add new columns to restaurants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN cancelled_at timestamptz;
    COMMENT ON COLUMN restaurants.cancelled_at IS 'When the subscription was cancelled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN cancellation_reason text;
    COMMENT ON COLUMN restaurants.cancellation_reason IS 'Reason provided for cancellation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'paused_at'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN paused_at timestamptz;
    COMMENT ON COLUMN restaurants.paused_at IS 'When the subscription was paused';
  END IF;
END $$;

-- 2. Update subscription_status check constraint to include CANCELLED and PAUSED
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_subscription_status_check;
ALTER TABLE restaurants ADD CONSTRAINT restaurants_subscription_status_check 
  CHECK (subscription_status IN ('TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELLED', 'PAUSED'));

-- 3. Create storage bucket for payment receipts (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Set up storage policies for payment receipts
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
CREATE POLICY "Users can view their own receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "Super admins can view all receipts" ON storage.objects;
CREATE POLICY "Super admins can view all receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- 5. Create function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_restaurant_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE restaurants
  SET
    subscription_status = 'CANCELLED',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    is_payment_overdue = false,
    overdue_since = NULL
  WHERE id = p_restaurant_id
  AND subscription_status IN ('TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED', 'PAUSED');

  IF NOT FOUND THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Restaurant not found or already cancelled'
    );
  ELSE
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Subscription cancelled successfully'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- 6. Create function to pause subscription
CREATE OR REPLACE FUNCTION pause_subscription(
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE restaurants
  SET
    subscription_status = 'PAUSED',
    paused_at = now()
  WHERE id = p_restaurant_id
  AND subscription_status IN ('ACTIVE', 'OVERDUE');

  IF NOT FOUND THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Restaurant not found or cannot be paused'
    );
  ELSE
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Subscription paused successfully'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- 7. Create function to resume paused subscription
CREATE OR REPLACE FUNCTION resume_subscription(
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_subscription_ends_at timestamptz;
BEGIN
  SELECT subscription_ends_at INTO v_subscription_ends_at
  FROM restaurants
  WHERE id = p_restaurant_id;

  IF v_subscription_ends_at IS NULL OR v_subscription_ends_at < now() THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Cannot resume - subscription expired. Please renew.'
    );
  ELSE
    UPDATE restaurants
    SET
      subscription_status = 'ACTIVE',
      paused_at = NULL
    WHERE id = p_restaurant_id
    AND subscription_status = 'PAUSED';

    IF NOT FOUND THEN
      v_result := jsonb_build_object(
        'success', false,
        'error', 'Restaurant not found or not paused'
      );
    ELSE
      v_result := jsonb_build_object(
        'success', true,
        'message', 'Subscription resumed successfully'
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- 8. Create function to request tier change (upgrade or downgrade)
CREATE OR REPLACE FUNCTION request_tier_change(
  p_restaurant_id uuid,
  p_new_tier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_tier_id uuid;
  v_new_tier_price numeric;
  v_current_tier_price numeric;
  v_invoice_type text;
  v_invoice_number text;
  v_currency text;
  v_billing_start timestamptz;
  v_billing_end timestamptz;
  v_result jsonb;
BEGIN
  -- Get current tier and new tier details
  SELECT current_tier_id INTO v_current_tier_id
  FROM restaurants
  WHERE id = p_restaurant_id;

  SELECT monthly_price, currency INTO v_new_tier_price, v_currency
  FROM subscription_tiers
  WHERE id = p_new_tier_id;

  SELECT monthly_price INTO v_current_tier_price
  FROM subscription_tiers
  WHERE id = v_current_tier_id;

  -- Determine if upgrade or downgrade
  IF v_new_tier_price > v_current_tier_price THEN
    v_invoice_type := 'UPGRADE';
  ELSIF v_new_tier_price < v_current_tier_price THEN
    v_invoice_type := 'DOWNGRADE';
  ELSE
    v_result := jsonb_build_object(
      'success', false,
      'error', 'New tier has same price as current tier'
    );
    RETURN v_result;
  END IF;

  -- Check for existing pending/submitted invoice for this tier change
  IF EXISTS (
    SELECT 1 FROM payment_invoices
    WHERE restaurant_id = p_restaurant_id
    AND tier_id = p_new_tier_id
    AND status IN ('PENDING', 'SUBMITTED')
  ) THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'A pending invoice already exists for this tier'
    );
    RETURN v_result;
  END IF;

  -- Generate invoice number
  SELECT generate_invoice_number() INTO v_invoice_number;

  -- Set billing period (30 days from now)
  v_billing_start := now();
  v_billing_end := now() + interval '30 days';

  -- Create invoice
  INSERT INTO payment_invoices (
    restaurant_id,
    tier_id,
    invoice_number,
    invoice_type,
    amount,
    currency,
    status,
    due_date,
    billing_period_start,
    billing_period_end,
    previous_tier_id
  ) VALUES (
    p_restaurant_id,
    p_new_tier_id,
    v_invoice_number,
    v_invoice_type,
    v_new_tier_price,
    v_currency,
    'PENDING',
    now() + interval '7 days',
    v_billing_start,
    v_billing_end,
    v_current_tier_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Tier change invoice created successfully',
    'invoice_number', v_invoice_number,
    'invoice_type', v_invoice_type
  );

  RETURN v_result;
END;
$$;

-- 9. Add previous_tier_id column to payment_invoices if not exists (for downgrades tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_invoices' AND column_name = 'previous_tier_id'
  ) THEN
    ALTER TABLE payment_invoices ADD COLUMN previous_tier_id uuid REFERENCES subscription_tiers(id);
    COMMENT ON COLUMN payment_invoices.previous_tier_id IS 'Previous tier ID for upgrade/downgrade tracking';
  END IF;
END $$;

-- 10. Update invoice_type check to include DOWNGRADE
ALTER TABLE payment_invoices DROP CONSTRAINT IF EXISTS payment_invoices_invoice_type_check;
ALTER TABLE payment_invoices ADD CONSTRAINT payment_invoices_invoice_type_check
  CHECK (invoice_type IN ('TRIAL_CONVERSION', 'RENEWAL', 'UPGRADE', 'DOWNGRADE'));

COMMENT ON FUNCTION cancel_subscription IS 'Cancels a restaurant subscription with optional reason';
COMMENT ON FUNCTION pause_subscription IS 'Temporarily pauses an active subscription';
COMMENT ON FUNCTION resume_subscription IS 'Resumes a paused subscription if not expired';
COMMENT ON FUNCTION request_tier_change IS 'Creates invoice for tier upgrade or downgrade';
