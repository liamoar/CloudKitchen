/*
  # Improve Subscription Tier Management for Country-Specific Controls

  1. Changes
    - Make subscription tier limits more explicit and manageable
    - Ensure Basic tier has 40 order limit as specified
    - Add per-country configuration flexibility
    - Update existing tiers with proper limits

  2. Subscription Tier Logic
    - Basic Tier: 40 orders per month, limited products, limited storage
    - Premium Tier: Unlimited orders (-1), unlimited products (-1), more storage
    - Tiers are country-specific (UAE, Nepal initially)

  3. Business Controls
    - Each business is tied to a tier based on their country
    - Limits are enforced at application level
    - Super admin can update limits per country/tier
*/

-- Update existing Basic tiers to ensure 40 order limit
UPDATE subscription_tiers
SET order_limit_per_month = 40
WHERE name = 'Basic' AND order_limit_per_month != 40;

-- Ensure proper values for unlimited tiers
UPDATE subscription_tiers
SET 
  product_limit = -1,
  order_limit_per_month = -1
WHERE name = 'Premium';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_country_name ON subscription_tiers(country, name);

-- Add domain_status check if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'domain_status'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN domain_status text DEFAULT 'active' CHECK (domain_status IN ('active', 'pending', 'suspended'));
  END IF;
END $$;
