/*
  # Rename restaurant_id to business_id in remaining tables

  This migration updates all remaining tables that still use restaurant_id
  to use business_id instead to match the new businesses schema.

  ## Tables Updated
  - bundles
  - featured_products
  - offers
  - product_categories

  ## Changes Made
  - Drop existing foreign key constraints
  - Rename restaurant_id column to business_id
  - Add new foreign key constraints referencing businesses table
  - Update indexes to use business_id
*/

-- Update bundles table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bundles_restaurant_id_fkey'
    AND table_name = 'bundles'
  ) THEN
    ALTER TABLE bundles DROP CONSTRAINT bundles_restaurant_id_fkey;
  END IF;
END $$;

ALTER TABLE bundles RENAME COLUMN restaurant_id TO business_id;

ALTER TABLE bundles
  ADD CONSTRAINT bundles_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES businesses(id)
  ON DELETE CASCADE;

-- Update featured_products table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'featured_products_restaurant_id_fkey'
    AND table_name = 'featured_products'
  ) THEN
    ALTER TABLE featured_products DROP CONSTRAINT featured_products_restaurant_id_fkey;
  END IF;
END $$;

ALTER TABLE featured_products RENAME COLUMN restaurant_id TO business_id;

ALTER TABLE featured_products
  ADD CONSTRAINT featured_products_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES businesses(id)
  ON DELETE CASCADE;

-- Update offers table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'offers_restaurant_id_fkey'
    AND table_name = 'offers'
  ) THEN
    ALTER TABLE offers DROP CONSTRAINT offers_restaurant_id_fkey;
  END IF;
END $$;

ALTER TABLE offers RENAME COLUMN restaurant_id TO business_id;

ALTER TABLE offers
  ADD CONSTRAINT offers_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES businesses(id)
  ON DELETE CASCADE;

-- Update product_categories table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_categories_restaurant_id_fkey'
    AND table_name = 'product_categories'
  ) THEN
    ALTER TABLE product_categories DROP CONSTRAINT product_categories_restaurant_id_fkey;
  END IF;
END $$;

ALTER TABLE product_categories RENAME COLUMN restaurant_id TO business_id;

ALTER TABLE product_categories
  ADD CONSTRAINT product_categories_business_id_fkey
  FOREIGN KEY (business_id)
  REFERENCES businesses(id)
  ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_bundles_restaurant;
CREATE INDEX IF NOT EXISTS idx_bundles_business ON bundles(business_id);

DROP INDEX IF EXISTS idx_featured_products_restaurant;
CREATE INDEX IF NOT EXISTS idx_featured_products_business ON featured_products(business_id);

DROP INDEX IF EXISTS idx_offers_restaurant;
CREATE INDEX IF NOT EXISTS idx_offers_business ON offers(business_id);

DROP INDEX IF EXISTS idx_product_categories_restaurant;
CREATE INDEX IF NOT EXISTS idx_product_categories_business ON product_categories(business_id);