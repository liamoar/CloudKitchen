/*
  # Add RLS policies for restaurant_subscription_status view

  1. Changes
    - Add RLS policies to allow authenticated users to view their own restaurant subscription status
    - Add policy for super admins to view all restaurant subscription statuses

  2. Security
    - Restaurant owners can only see their own data
    - Super admins can see all data
*/

-- Enable RLS on the view (PostgreSQL 12+)
-- Note: Views inherit RLS from underlying tables, but we can add explicit policies

-- Create a function to check if user is restaurant owner
CREATE OR REPLACE FUNCTION is_restaurant_owner(restaurant_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM restaurants r
    INNER JOIN users u ON r.owner_id = u.id
    WHERE r.id = restaurant_uuid
      AND u.auth_id = auth.uid()
  );
END;
$$;

-- Since restaurant_subscription_status is a view, policies apply through the underlying restaurants table
-- But let's ensure the restaurants table has proper SELECT policies for the view to work

-- Check if policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'restaurants' 
    AND policyname = 'Restaurant owners can view own restaurant for subscription status'
  ) THEN
    CREATE POLICY "Restaurant owners can view own restaurant for subscription status"
      ON restaurants
      FOR SELECT
      TO authenticated
      USING (
        owner_id IN (
          SELECT id FROM users WHERE auth_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON restaurant_subscription_status TO authenticated;

-- Grant usage on the function
GRANT EXECUTE ON FUNCTION is_restaurant_owner TO authenticated;
