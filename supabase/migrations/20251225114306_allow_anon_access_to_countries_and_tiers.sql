/*
  # Allow Anonymous Access to Countries and Subscription Tiers

  This migration fixes the RLS policies to allow anonymous users (not logged in)
  to view countries and subscription tiers on the landing page during signup.

  ## Changes Made
  1. Drop existing restrictive policies for countries and subscription_tiers
  2. Create new policies that allow both authenticated and anonymous users to view:
     - Active countries
     - Active subscription tiers

  ## Security
  - Anonymous users can only SELECT (read) data
  - Only active records are visible
  - Superadmins retain full management access
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Countries are viewable by everyone" ON countries;
DROP POLICY IF EXISTS "Tiers are viewable by everyone" ON subscription_tiers;

-- Create new policies that allow anonymous access for reading
CREATE POLICY "Allow public read access to active countries"
  ON countries FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE POLICY "Allow public read access to active tiers"
  ON subscription_tiers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
