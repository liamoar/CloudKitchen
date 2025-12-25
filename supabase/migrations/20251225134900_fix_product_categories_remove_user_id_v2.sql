/*
  # Remove Obsolete user_id Column from product_categories
  
  1. Changes
    - Drop old policy that references user_id
    - Drop user_id column from product_categories table
    - Add new policy using business_id to link categories to business owners
    
  2. Why
    - The system was migrated to use business_id instead of user_id
    - The user_id column is NOT NULL but no longer being populated
    - This was causing category creation to fail
    
  3. Impact
    - Category creation will now work properly
    - Business owners can manage categories for their business
    - No data loss as user_id was not being used correctly
*/

-- Drop old policy that depends on user_id
DROP POLICY IF EXISTS "Owner can manage own categories" ON product_categories;

-- Remove user_id column from product_categories
ALTER TABLE product_categories DROP COLUMN IF EXISTS user_id;

-- Add policy for business owners to manage their categories
CREATE POLICY "Business owners can manage their categories"
  ON product_categories
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );
