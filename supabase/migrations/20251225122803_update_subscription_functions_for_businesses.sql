/*
  # Update Subscription and Limit Check Functions

  This migration updates database functions that manage subscriptions and limits
  to use the new 'businesses' table schema instead of 'restaurants'.

  ## Functions Updated
  1. `check_product_limit` - Validates product count against tier limits
  2. `check_order_limit` - Validates order count against tier limits  
  3. `cancel_subscription` - Cancels a business subscription
  4. `pause_subscription` - Pauses an active subscription
  5. `resume_subscription` - Resumes a paused subscription
  
  ## Changes Made
  - Updated all table references: restaurants → businesses
  - Updated all foreign key references: restaurant_id → business_id
  - Updated subscription status values to lowercase
  - Updated column references to match new schema
*/

-- Update check_product_limit function
DROP FUNCTION IF EXISTS check_product_limit(uuid);

CREATE OR REPLACE FUNCTION check_product_limit(business_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  allowed_limit integer;
  tier_name text;
  result jsonb;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.products
  WHERE business_id = business_uuid;

  SELECT st.product_limit, st.name
  INTO allowed_limit, tier_name
  FROM public.businesses b
  INNER JOIN public.subscription_tiers st ON b.subscription_tier_id = st.id
  WHERE b.id = business_uuid;

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

-- Update check_order_limit function
DROP FUNCTION IF EXISTS check_order_limit(uuid);

CREATE OR REPLACE FUNCTION check_order_limit(business_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  allowed_limit integer;
  tier_name text;
  result jsonb;
BEGIN
  current_count := public.get_monthly_order_count(business_uuid);

  SELECT st.order_limit_per_month, st.name
  INTO allowed_limit, tier_name
  FROM public.businesses b
  INNER JOIN public.subscription_tiers st ON b.subscription_tier_id = st.id
  WHERE b.id = business_uuid;

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

-- Update cancel_subscription function
DROP FUNCTION IF EXISTS cancel_subscription(uuid, text);

CREATE OR REPLACE FUNCTION cancel_subscription(p_business_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE businesses
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_business_id
  AND status IN ('trial', 'active', 'inactive');

  IF NOT FOUND THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Business not found or already cancelled'
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

-- Update pause_subscription function
DROP FUNCTION IF EXISTS pause_subscription(uuid);

CREATE OR REPLACE FUNCTION pause_subscription(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE businesses
  SET
    status = 'inactive',
    updated_at = now()
  WHERE id = p_business_id
  AND status = 'active';

  IF NOT FOUND THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Business not found or cannot be paused'
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

-- Update resume_subscription function
DROP FUNCTION IF EXISTS resume_subscription(uuid);

CREATE OR REPLACE FUNCTION resume_subscription(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_subscription_ends_at timestamptz;
BEGIN
  SELECT current_period_ends_at INTO v_subscription_ends_at
  FROM businesses
  WHERE id = p_business_id;

  IF v_subscription_ends_at IS NULL OR v_subscription_ends_at < now() THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Cannot resume - subscription expired. Please renew.'
    );
  ELSE
    UPDATE businesses
    SET
      status = 'active',
      updated_at = now()
    WHERE id = p_business_id
    AND status = 'inactive';

    IF NOT FOUND THEN
      v_result := jsonb_build_object(
        'success', false,
        'error', 'Business not found or not paused'
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