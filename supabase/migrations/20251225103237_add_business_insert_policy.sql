/*
  # Add INSERT Policy for Businesses Table

  1. Problem
    - Users cannot create businesses during signup
    - RLS is blocking INSERT operations because there's no INSERT policy
    - Only SELECT and UPDATE policies exist for business owners

  2. Changes
    - Add INSERT policy to allow authenticated users to create businesses
    - User must be the owner of the business they're creating
    - This enables the signup flow to work properly

  3. Security
    - Users can only create businesses where they are the owner (owner_id = auth.uid())
    - Superadmins can still manage all businesses via their existing ALL policy
*/

-- Add INSERT policy for authenticated users to create their own business
CREATE POLICY "Authenticated users can create their own business"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
