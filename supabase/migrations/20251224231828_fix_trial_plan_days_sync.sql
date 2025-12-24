/*
  # Fix Trial Plan Days to Match Trial Days

  ## Overview
  Fixes the plan_days column for Trial tiers to match their trial_days setting.
  Updates existing restaurants to use the correct trial end dates.

  ## Changes

  ### 1. Update Trial Tier Plan Days
  - Set plan_days = trial_days for all Trial tiers
  - This ensures trial period duration is read from the tier configuration

  ### 2. Update Existing Restaurant Trial Dates
  - Recalculate trial_ends_at for all restaurants in TRIAL status
  - Uses the correct plan_days from their assigned Trial tier

  ## Security
  - Uses SECURITY DEFINER for system-level updates
  - Maintains data integrity for trial period calculations
*/

-- 1. Update plan_days to match trial_days for all Trial tiers
UPDATE subscription_tiers
SET plan_days = trial_days
WHERE name = 'Trial';

-- 2. Update existing restaurants in TRIAL status to have correct trial_ends_at
DO $$
DECLARE
  restaurant_rec RECORD;
  trial_plan_days integer;
BEGIN
  FOR restaurant_rec IN 
    SELECT r.id, r.created_at, r.current_tier_id
    FROM restaurants r
    WHERE r.subscription_status = 'TRIAL'
  LOOP
    -- Get the plan_days from the restaurant's Trial tier
    SELECT plan_days INTO trial_plan_days
    FROM subscription_tiers
    WHERE id = restaurant_rec.current_tier_id;

    -- Update trial_ends_at based on correct plan_days
    IF trial_plan_days IS NOT NULL THEN
      UPDATE restaurants
      SET trial_ends_at = restaurant_rec.created_at + (trial_plan_days || ' days')::interval
      WHERE id = restaurant_rec.id;
    END IF;
  END LOOP;
END $$;

-- 3. Add comment for clarity
COMMENT ON COLUMN subscription_tiers.plan_days IS 'Number of days this plan is valid for per billing cycle. For Trial tiers, this should match trial_days.';
