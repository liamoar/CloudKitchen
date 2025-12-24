/*
  # Add Trial Tier and Plan Days to Subscription System

  ## Overview
  Introduces the Trial tier as an actual subscription tier with configurable plan days.
  Each tier now has plan_days defining how long the subscription lasts per payment.

  ## Changes

  ### 1. Add plan_days Column
  - Add plan_days to subscription_tiers (number of days per billing cycle)
  - Trial tier: configurable trial period (e.g., 5, 15 days)
  - Basic/Premium: typically 30 days per month

  ### 2. Create Trial Tier
  - Create Trial tier for each country with appropriate limits
  - Trial tier uses existing trial_days as plan_days
  - Free tier with restricted limits

  ### 3. Update Restaurant Creation
  - Assign Trial tier to new restaurants
  - Calculate trial_ends_at based on tier's plan_days

  ### 4. Update Tier Sorting
  - Add tier_order to ensure Trial shows first
*/

-- 1. Add plan_days column to subscription_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'plan_days'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN plan_days integer NOT NULL DEFAULT 30;
    COMMENT ON COLUMN subscription_tiers.plan_days IS 'Number of days this plan is valid for per billing cycle';
  END IF;
END $$;

-- 2. Add tier_order column for sorting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'tier_order'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN tier_order integer NOT NULL DEFAULT 0;
    COMMENT ON COLUMN subscription_tiers.tier_order IS 'Display order (0=Trial, 1=Basic, 2=Premium)';
  END IF;
END $$;

-- 3. Set plan_days for existing tiers to 30 (monthly)
UPDATE subscription_tiers 
SET plan_days = 30, tier_order = CASE 
  WHEN name = 'Basic' THEN 1
  WHEN name = 'Premium' THEN 2
  ELSE 3
END
WHERE name IN ('Basic', 'Premium');

-- 4. Create Trial tier for each country (if not exists)
DO $$
DECLARE
  country_rec RECORD;
  trial_tier_id uuid;
BEGIN
  FOR country_rec IN 
    SELECT DISTINCT country, trial_days, overdue_grace_days, currency 
    FROM subscription_tiers
  LOOP
    -- Check if Trial tier already exists for this country
    SELECT id INTO trial_tier_id
    FROM subscription_tiers
    WHERE country = country_rec.country
    AND name = 'Trial'
    LIMIT 1;

    -- Create if doesn't exist
    IF trial_tier_id IS NULL THEN
      INSERT INTO subscription_tiers (
        name,
        country,
        currency,
        monthly_price,
        plan_days,
        trial_days,
        overdue_grace_days,
        product_limit,
        order_limit_per_month,
        storage_limit_mb,
        is_active,
        tier_order,
        country_bank_name,
        country_account_holder,
        country_account_number,
        country_bank_qr_url
      ) 
      SELECT 
        'Trial',
        country_rec.country,
        country_rec.currency,
        0, -- Free trial
        country_rec.trial_days, -- Trial plan days = trial_days from existing config
        country_rec.trial_days, -- Keep trial_days for reference
        country_rec.overdue_grace_days,
        10, -- Limited products during trial
        50, -- Limited orders during trial
        100, -- Limited storage during trial
        true,
        0, -- Show first
        country_bank_name,
        country_account_holder,
        country_account_number,
        country_bank_qr_url
      FROM subscription_tiers
      WHERE country = country_rec.country
      LIMIT 1;
    END IF;
  END LOOP;
END $$;

-- 5. Drop existing triggers and functions with CASCADE
DROP FUNCTION IF EXISTS set_trial_end_date() CASCADE;
DROP FUNCTION IF EXISTS set_restaurant_trial_dates() CASCADE;

-- 6. Create new restaurant creation trigger to use Trial tier
CREATE OR REPLACE FUNCTION set_trial_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_tier_id uuid;
  trial_plan_days integer;
BEGIN
  -- Find Trial tier for this restaurant's country
  SELECT id, plan_days INTO trial_tier_id, trial_plan_days
  FROM subscription_tiers
  WHERE country = NEW.country
  AND name = 'Trial'
  AND is_active = true
  LIMIT 1;

  -- If no Trial tier, fall back to Basic
  IF trial_tier_id IS NULL THEN
    SELECT id, trial_days INTO trial_tier_id, trial_plan_days
    FROM subscription_tiers
    WHERE country = NEW.country
    AND name = 'Basic'
    AND is_active = true
    LIMIT 1;
  END IF;

  -- Set trial tier and calculate end date
  IF trial_tier_id IS NOT NULL THEN
    NEW.current_tier_id := trial_tier_id;
    NEW.trial_ends_at := now() + (trial_plan_days || ' days')::interval;
    NEW.subscription_status := 'TRIAL';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_trial_end_date_trigger
  BEFORE INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_end_date();

-- 7. Update request_tier_change function to use plan_days
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
  v_new_tier_plan_days integer;
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

  SELECT monthly_price, currency, plan_days 
  INTO v_new_tier_price, v_currency, v_new_tier_plan_days
  FROM subscription_tiers
  WHERE id = p_new_tier_id;

  SELECT monthly_price INTO v_current_tier_price
  FROM subscription_tiers
  WHERE id = v_current_tier_id;

  -- Cannot switch to Trial tier
  IF EXISTS (SELECT 1 FROM subscription_tiers WHERE id = p_new_tier_id AND name = 'Trial') THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Cannot switch to Trial tier'
    );
    RETURN v_result;
  END IF;

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

  -- Set billing period using new tier's plan_days
  v_billing_start := now();
  v_billing_end := now() + (v_new_tier_plan_days || ' days')::interval;

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

COMMENT ON FUNCTION set_trial_end_date IS 'Sets Trial tier and trial_ends_at based on tier plan_days for new restaurants';
COMMENT ON FUNCTION request_tier_change IS 'Creates invoice for tier upgrade or downgrade using tier-specific plan_days';
