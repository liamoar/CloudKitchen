/*
  # Update Database Functions to Use Businesses Schema

  This migration updates existing database functions that still reference
  the old 'restaurants' table to use the new 'businesses' table instead.

  ## Functions Updated
  1. `get_restaurant_currency` - Now uses businesses and countries tables
  2. `is_restaurant_owner` - Now validates business ownership
  
  ## Changes Made
  - Updated table references: restaurants → businesses
  - Updated foreign key joins to use countries table for currency
  - Maintained function signatures for backward compatibility
*/

-- Drop and recreate get_restaurant_currency function
DROP FUNCTION IF EXISTS get_restaurant_currency(uuid);

CREATE OR REPLACE FUNCTION get_restaurant_currency(business_id_param uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  business_currency_result text;
BEGIN
  SELECT c.currency_symbol INTO business_currency_result
  FROM businesses b
  JOIN countries c ON b.country_id = c.id
  WHERE b.id = business_id_param;

  RETURN COALESCE(business_currency_result, '$');
END;
$$;

-- Drop and recreate is_restaurant_owner function
DROP FUNCTION IF EXISTS is_restaurant_owner(uuid);

CREATE OR REPLACE FUNCTION is_restaurant_owner(business_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.businesses b
    INNER JOIN public.users u ON b.owner_id = u.id
    WHERE b.id = business_uuid
    AND u.auth_id = auth.uid()
  );
END;
$$;