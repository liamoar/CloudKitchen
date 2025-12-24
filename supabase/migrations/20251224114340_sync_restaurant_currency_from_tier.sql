/*
  # Sync Restaurant Currency from Subscription Tier

  1. Changes
    - Remove redundant currency fields from restaurants
    - Use tier's currency as single source of truth
    - Create function to get restaurant currency from tier
    - Update existing restaurants to have correct currency from their tier

  2. Security
    - Maintain existing RLS policies
*/

-- Update restaurants currency from their tier
UPDATE restaurants r
SET restaurant_currency = st.currency
FROM subscription_tiers st
WHERE r.tier_id = st.id;

-- Create function to get restaurant currency
CREATE OR REPLACE FUNCTION get_restaurant_currency(restaurant_id_param uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  restaurant_currency_result text;
BEGIN
  SELECT st.currency INTO restaurant_currency_result
  FROM restaurants r
  JOIN subscription_tiers st ON r.tier_id = st.id
  WHERE r.id = restaurant_id_param;
  
  RETURN COALESCE(restaurant_currency_result, 'USD');
END;
$$;
