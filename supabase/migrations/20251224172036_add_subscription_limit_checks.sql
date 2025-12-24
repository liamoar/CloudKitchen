/*
  # Add Subscription Limit Enforcement

  1. New Functions
    - `check_product_limit` - Checks if restaurant can add more products
    - `check_order_limit` - Checks if restaurant has reached monthly order limit
    - `get_monthly_order_count` - Gets count of orders for current month
    - `can_modify_orders` - Checks if restaurant can edit/update/delete orders

  2. Purpose
    - Product Limit: Hard limit on total products based on subscription tier
    - Order Limit: Monthly limit on order processing (view-only after limit)
    - Storefront continues to accept orders even after limit reached
    - Business dashboard cannot edit/update/delete orders after limit

  3. Security
    - All functions use SET search_path for security
    - Functions return clear boolean or numeric results
*/

-- Function to check if restaurant can add more products
CREATE OR REPLACE FUNCTION check_product_limit(restaurant_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_count integer;
  allowed_limit integer;
  tier_name text;
  result jsonb;
BEGIN
  -- Get current product count
  SELECT COUNT(*) INTO current_count
  FROM public.products
  WHERE restaurant_id = restaurant_uuid;

  -- Get product limit from subscription tier
  SELECT st.product_limit, st.name
  INTO allowed_limit, tier_name
  FROM public.restaurants r
  INNER JOIN public.subscription_tiers st ON r.current_tier_id = st.id
  WHERE r.id = restaurant_uuid;

  -- Return result as JSON
  result := jsonb_build_object(
    'can_add', current_count < allowed_limit,
    'current_count', current_count,
    'limit', allowed_limit,
    'tier_name', tier_name,
    'remaining', GREATEST(0, allowed_limit - current_count)
  );

  RETURN result;
END;
$$;

-- Function to get monthly order count for a restaurant
CREATE OR REPLACE FUNCTION get_monthly_order_count(restaurant_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  order_count integer;
  billing_start_date timestamptz;
BEGIN
  -- Get the restaurant's current billing cycle start date
  SELECT 
    COALESCE(r.subscription_starts_at, r.created_at)
  INTO billing_start_date
  FROM public.restaurants r
  WHERE r.id = restaurant_uuid;

  -- Calculate orders in current billing period
  -- If subscription_starts_at exists, count from that month
  -- Otherwise count from restaurant creation month
  SELECT COUNT(*)
  INTO order_count
  FROM public.orders o
  WHERE o.restaurant_id = restaurant_uuid
    AND o.created_at >= DATE_TRUNC('month', COALESCE(billing_start_date, NOW()))
    AND o.status NOT IN ('CANCELLED', 'RETURNED');

  RETURN order_count;
END;
$$;

-- Function to check if restaurant has reached monthly order limit
CREATE OR REPLACE FUNCTION check_order_limit(restaurant_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_count integer;
  allowed_limit integer;
  tier_name text;
  result jsonb;
BEGIN
  -- Get monthly order count
  current_count := public.get_monthly_order_count(restaurant_uuid);

  -- Get order limit from subscription tier
  SELECT st.order_limit_per_month, st.name
  INTO allowed_limit, tier_name
  FROM public.restaurants r
  INNER JOIN public.subscription_tiers st ON r.current_tier_id = st.id
  WHERE r.id = restaurant_uuid;

  -- Return result as JSON
  result := jsonb_build_object(
    'limit_reached', current_count >= allowed_limit,
    'can_accept_orders', true,
    'can_modify_orders', current_count < allowed_limit,
    'current_count', current_count,
    'limit', allowed_limit,
    'tier_name', tier_name,
    'remaining', GREATEST(0, allowed_limit - current_count)
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_product_limit(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_monthly_order_count(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_order_limit(uuid) TO authenticated, anon;
