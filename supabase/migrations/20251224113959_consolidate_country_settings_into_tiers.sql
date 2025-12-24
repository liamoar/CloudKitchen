/*
  # Consolidate Country Settings into Subscription Tiers

  1. Changes
    - Add currency, trial_days, overdue_grace_days, country_name to subscription_tiers table
    - Migrate currency data from subscription_configs to subscription_tiers
    - Add country_name for display purposes (e.g., "United Arab Emirates" for "AE")
    - Keep subscription_configs for backward compatibility but deprecate it

  2. New Columns in subscription_tiers
    - currency: Currency code (AED, USD, NPR, etc.)
    - trial_days: Number of days for trial period
    - overdue_grace_days: Grace period after payment is overdue
    - country_name: Full country name for display

  3. Security
    - Maintain existing RLS policies
*/

-- Add new columns to subscription_tiers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_tiers' AND column_name = 'currency'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN currency text NOT NULL DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_tiers' AND column_name = 'trial_days'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN trial_days integer NOT NULL DEFAULT 15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_tiers' AND column_name = 'overdue_grace_days'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN overdue_grace_days integer NOT NULL DEFAULT 2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_tiers' AND column_name = 'country_name'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN country_name text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Migrate currency data from subscription_configs to subscription_tiers
UPDATE subscription_tiers st
SET 
  currency = sc.currency,
  trial_days = sc.trial_days,
  overdue_grace_days = sc.overdue_grace_days
FROM subscription_configs sc
WHERE st.country = sc.country;

-- Set country_name for existing countries
UPDATE subscription_tiers SET country_name = 'United Arab Emirates' WHERE country = 'AE';
UPDATE subscription_tiers SET country_name = 'Nepal' WHERE country = 'NP';
UPDATE subscription_tiers SET country_name = 'India' WHERE country = 'IN';
UPDATE subscription_tiers SET country_name = 'United States' WHERE country = 'US';
UPDATE subscription_tiers SET country_name = 'United Kingdom' WHERE country = 'GB';
UPDATE subscription_tiers SET country_name = 'European Union' WHERE country = 'EU';

-- Add unique constraint on country + name combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_tiers_country_name_key'
  ) THEN
    ALTER TABLE subscription_tiers ADD CONSTRAINT subscription_tiers_country_name_key UNIQUE (country, name);
  END IF;
END $$;
