/*
  # Fix Security Definer and Search Path Issues

  1. Changes
    - Remove SECURITY DEFINER from restaurant_subscription_status view
    - Add proper search_path settings to all SECURITY DEFINER functions
    - Set search_path to empty or specific schema to prevent injection attacks

  2. Security Improvements
    - Prevents search_path injection in all functions
    - Uses proper RLS instead of SECURITY DEFINER for views
    - All functions now have immutable search_path
*/

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS restaurant_subscription_status;

CREATE VIEW restaurant_subscription_status AS
SELECT 
  r.id,
  r.name,
  r.status,
  r.created_at,
  r.trial_ends_at,
  r.subscription_ends_at,
  r.subscription_starts_at,
  r.country,
  st.name AS tier_name,
  st.trial_days,
  st.overdue_grace_days,
  st.monthly_price,
  st.currency,
  st.product_limit,
  st.order_limit_per_month,
  CASE
    WHEN r.status = 'TRIAL' AND r.trial_ends_at IS NOT NULL 
    THEN GREATEST(0, EXTRACT(day FROM (r.trial_ends_at - now())))::integer
    ELSE 0
  END AS trial_days_remaining,
  CASE
    WHEN r.status = 'ACTIVE' AND r.subscription_ends_at IS NOT NULL 
    THEN GREATEST(0, EXTRACT(day FROM (r.subscription_ends_at - now())))::integer
    ELSE 0
  END AS subscription_days_remaining,
  CASE
    WHEN r.status = 'TRIAL' AND r.trial_ends_at IS NOT NULL 
    THEN (r.trial_ends_at - now()) < interval '5 days'
    WHEN r.status = 'ACTIVE' AND r.subscription_ends_at IS NOT NULL 
    THEN (r.subscription_ends_at - now()) < interval '5 days'
    ELSE false
  END AS ending_soon,
  CASE
    WHEN r.status = 'TRIAL' AND r.trial_ends_at IS NOT NULL 
    THEN EXTRACT(day FROM (r.trial_ends_at - now()))::integer
    WHEN r.status = 'ACTIVE' AND r.subscription_ends_at IS NOT NULL 
    THEN EXTRACT(day FROM (r.subscription_ends_at - now()))::integer
    ELSE 0
  END AS days_until_action_needed
FROM restaurants r
LEFT JOIN subscription_tiers st ON r.current_tier_id = st.id;

-- Fix generate_invoice_number function
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_number TEXT;
  counter INT;
BEGIN
  counter := (SELECT COUNT(*) FROM public.payment_invoices) + 1;
  new_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(counter::TEXT, 6, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.payment_invoices WHERE invoice_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(counter::TEXT, 6, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Fix update_payment_invoice_updated_at function
CREATE OR REPLACE FUNCTION update_payment_invoice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix get_basic_tier_for_country function
CREATE OR REPLACE FUNCTION get_basic_tier_for_country(country_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tier_id uuid;
BEGIN
  SELECT id INTO tier_id
  FROM public.subscription_tiers
  WHERE country = country_code
    AND name = 'Basic'
    AND is_active = true
  LIMIT 1;
  
  RETURN tier_id;
END;
$$;

-- Fix set_trial_end_date function
CREATE OR REPLACE FUNCTION set_trial_end_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tier_trial_days integer;
BEGIN
  -- If current_tier_id is NULL, assign Basic tier for the country
  IF NEW.current_tier_id IS NULL AND NEW.country IS NOT NULL THEN
    NEW.current_tier_id := public.get_basic_tier_for_country(NEW.country);
  END IF;
  
  -- If we now have a tier, set trial_ends_at
  IF NEW.current_tier_id IS NOT NULL AND NEW.status = 'TRIAL' THEN
    SELECT trial_days INTO tier_trial_days
    FROM public.subscription_tiers
    WHERE id = NEW.current_tier_id;
    
    IF tier_trial_days IS NOT NULL THEN
      NEW.trial_ends_at := NEW.created_at + (tier_trial_days || ' days')::interval;
    END IF;
  END IF;
  
  -- If subscription is activated, set subscription dates
  IF NEW.status = 'ACTIVE' AND OLD.status = 'TRIAL' THEN
    NEW.subscription_starts_at := NOW();
    NEW.subscription_ends_at := NOW() + interval '30 days';
    NEW.next_billing_date := NOW() + interval '30 days';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix recalculate_trial_dates_for_tier function
CREATE OR REPLACE FUNCTION recalculate_trial_dates_for_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only recalculate if trial_days changed
  IF OLD.trial_days IS DISTINCT FROM NEW.trial_days THEN
    UPDATE public.restaurants
    SET trial_ends_at = created_at + (NEW.trial_days || ' days')::interval
    WHERE current_tier_id = NEW.id
      AND status = 'TRIAL';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix is_restaurant_owner function
CREATE OR REPLACE FUNCTION is_restaurant_owner(restaurant_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.restaurants r
    INNER JOIN public.users u ON r.owner_id = u.id
    WHERE r.id = restaurant_uuid
      AND u.auth_id = auth.uid()
  );
END;
$$;
