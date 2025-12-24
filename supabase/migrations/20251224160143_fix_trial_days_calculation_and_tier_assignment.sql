/*
  # Fix Trial Days Calculation and Automatic Tier Assignment

  1. Changes
    - Create trigger to automatically assign Basic tier to new restaurants based on country
    - Update trial_ends_at based on created_at + trial_days from tier
    - Update subscription_ends_at to be created_at + trial_days + 30 days when subscription is activated
    - Create function to recalculate all restaurants' trial_ends_at when tier trial_days are updated
    - Update existing restaurants to have correct tier and trial dates

  2. Security
    - Functions are SECURITY DEFINER to bypass RLS for system operations
*/

-- Function to get the Basic tier for a country
CREATE OR REPLACE FUNCTION get_basic_tier_for_country(country_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_id uuid;
BEGIN
  SELECT id INTO tier_id
  FROM subscription_tiers
  WHERE country = country_code
    AND name = 'Basic'
    AND is_active = true
  LIMIT 1;
  
  RETURN tier_id;
END;
$$;

-- Function to set trial end date based on tier
CREATE OR REPLACE FUNCTION set_trial_end_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_trial_days integer;
BEGIN
  -- If current_tier_id is NULL, assign Basic tier for the country
  IF NEW.current_tier_id IS NULL AND NEW.country IS NOT NULL THEN
    NEW.current_tier_id := get_basic_tier_for_country(NEW.country);
  END IF;

  -- If we now have a tier, set trial_ends_at
  IF NEW.current_tier_id IS NOT NULL AND NEW.status = 'TRIAL' THEN
    SELECT trial_days INTO tier_trial_days
    FROM subscription_tiers
    WHERE id = NEW.current_tier_id;
    
    IF tier_trial_days IS NOT NULL THEN
      NEW.trial_ends_at := NEW.created_at + (tier_trial_days || ' days')::interval;
    END IF;
  END IF;

  -- If subscription is activated, set subscription dates
  IF NEW.status = 'ACTIVE' AND OLD.status = 'TRIAL' THEN
    NEW.subscription_starts_at := NOW();
    -- Default to 30 days subscription
    NEW.subscription_ends_at := NOW() + interval '30 days';
    NEW.next_billing_date := NOW() + interval '30 days';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new restaurants
DROP TRIGGER IF EXISTS set_restaurant_trial_dates ON restaurants;
CREATE TRIGGER set_restaurant_trial_dates
  BEFORE INSERT OR UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_end_date();

-- Function to recalculate trial_ends_at for all TRIAL restaurants when tier trial_days changes
CREATE OR REPLACE FUNCTION recalculate_trial_dates_for_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only recalculate if trial_days changed
  IF OLD.trial_days IS DISTINCT FROM NEW.trial_days THEN
    UPDATE restaurants
    SET trial_ends_at = created_at + (NEW.trial_days || ' days')::interval
    WHERE current_tier_id = NEW.id
      AND status = 'TRIAL';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on subscription_tiers
DROP TRIGGER IF EXISTS recalculate_trial_dates ON subscription_tiers;
CREATE TRIGGER recalculate_trial_dates
  AFTER UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_trial_dates_for_tier();

-- Update existing restaurants to have correct tier and trial dates
UPDATE restaurants r
SET 
  current_tier_id = (
    SELECT id 
    FROM subscription_tiers st 
    WHERE st.country = r.country 
      AND st.name = 'Basic' 
      AND st.is_active = true 
    LIMIT 1
  ),
  trial_ends_at = r.created_at + (
    SELECT (trial_days || ' days')::interval
    FROM subscription_tiers st
    WHERE st.country = r.country
      AND st.name = 'Basic'
      AND st.is_active = true
    LIMIT 1
  )
WHERE current_tier_id IS NULL
  AND status = 'TRIAL';

-- Create a view for easy access to remaining days
CREATE OR REPLACE VIEW restaurant_subscription_status AS
SELECT 
  r.id,
  r.name,
  r.status,
  r.created_at,
  r.trial_ends_at,
  r.subscription_ends_at,
  r.subscription_starts_at,
  r.country,
  st.name as tier_name,
  st.trial_days,
  st.overdue_grace_days,
  st.monthly_price,
  st.currency,
  st.product_limit,
  st.order_limit_per_month,
  -- Calculate remaining trial days
  CASE 
    WHEN r.status = 'TRIAL' AND r.trial_ends_at IS NOT NULL THEN 
      GREATEST(0, EXTRACT(DAY FROM (r.trial_ends_at - NOW())))::integer
    ELSE 0
  END as trial_days_remaining,
  -- Calculate remaining subscription days
  CASE 
    WHEN r.status = 'ACTIVE' AND r.subscription_ends_at IS NOT NULL THEN
      GREATEST(0, EXTRACT(DAY FROM (r.subscription_ends_at - NOW())))::integer
    ELSE 0
  END as subscription_days_remaining,
  -- Check if ending soon (less than 5 days)
  CASE
    WHEN r.status = 'TRIAL' AND r.trial_ends_at IS NOT NULL THEN
      (r.trial_ends_at - NOW()) < interval '5 days'
    WHEN r.status = 'ACTIVE' AND r.subscription_ends_at IS NOT NULL THEN
      (r.subscription_ends_at - NOW()) < interval '5 days'
    ELSE false
  END as ending_soon,
  -- Days until ending (for sorting/display)
  CASE
    WHEN r.status = 'TRIAL' AND r.trial_ends_at IS NOT NULL THEN
      EXTRACT(DAY FROM (r.trial_ends_at - NOW()))::integer
    WHEN r.status = 'ACTIVE' AND r.subscription_ends_at IS NOT NULL THEN
      EXTRACT(DAY FROM (r.subscription_ends_at - NOW()))::integer
    ELSE 0
  END as days_until_action_needed
FROM restaurants r
LEFT JOIN subscription_tiers st ON r.current_tier_id = st.id;

-- Grant access to the view
GRANT SELECT ON restaurant_subscription_status TO authenticated;
