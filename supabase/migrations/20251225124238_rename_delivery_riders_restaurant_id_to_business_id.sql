/*
  # Rename restaurant_id to business_id in delivery_riders table

  This migration updates the delivery_riders table to use business_id instead
  of restaurant_id to match the new businesses schema.

  ## Changes Made
  - Drop existing foreign key constraint
  - Rename restaurant_id column to business_id
  - Add new foreign key constraint referencing businesses table
  - Update indexes to use business_id
*/

-- Drop old foreign key constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'delivery_riders_restaurant_id_fkey'
    AND table_name = 'delivery_riders'
  ) THEN
    ALTER TABLE delivery_riders DROP CONSTRAINT delivery_riders_restaurant_id_fkey;
  END IF;
END $$;

-- Rename column
ALTER TABLE delivery_riders 
  RENAME COLUMN restaurant_id TO business_id;

-- Add new foreign key constraint
ALTER TABLE delivery_riders
  ADD CONSTRAINT delivery_riders_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES businesses(id)
  ON DELETE CASCADE;

-- Drop and recreate index if it exists
DROP INDEX IF EXISTS idx_delivery_riders_restaurant;
CREATE INDEX IF NOT EXISTS idx_delivery_riders_business 
  ON delivery_riders(business_id, is_active);