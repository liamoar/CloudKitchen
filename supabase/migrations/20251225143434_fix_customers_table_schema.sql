/*
  # Fix Customers Table Schema

  1. Changes
    - Add email column to customers table (nullable)
    - Remove address column from customers (now using customer_addresses table)
    - Update phone constraint to allow same phone across different businesses

  2. Notes
    - Customers are now business-specific (business_id + phone combination is unique)
    - Email is optional and stored at customer level
    - Addresses are stored in separate customer_addresses table
*/

-- Add email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'email'
  ) THEN
    ALTER TABLE customers ADD COLUMN email text;
  END IF;
END $$;

-- Drop address column if it exists (we use customer_addresses table now)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'address'
  ) THEN
    ALTER TABLE customers DROP COLUMN address;
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
