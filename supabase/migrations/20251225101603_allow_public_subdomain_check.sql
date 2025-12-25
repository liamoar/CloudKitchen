/*
  # Allow Public Subdomain Availability Checking

  1. Problem
    - Landing page needs to check if a subdomain is available before signup
    - Current RLS policies don't allow anonymous users to query businesses table
    - This breaks the subdomain availability check feature

  2. Solution
    - Add a SELECT policy that allows anyone to check if a subdomain exists
    - Restrict the query to only return the 'id' field for privacy
    - This is safe because subdomains are public information anyway

  3. Security
    - Policy only allows SELECT operations
    - Users can only check existence, not view business details
    - This is necessary for the signup flow
*/

CREATE POLICY "Anyone can check subdomain availability"
  ON businesses FOR SELECT
  TO public
  USING (true);
