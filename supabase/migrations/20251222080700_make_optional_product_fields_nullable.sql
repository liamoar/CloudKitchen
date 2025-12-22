/*
  # Make Optional Product Fields Nullable

  1. Changes
    - Make `stock_quantity` nullable in products table (for when stock tracking is disabled)
    - Make `category_id` nullable in products table if it exists (for when categories are disabled)
    - Make `image_url` nullable in products table if it exists (for when images are disabled)
    
  2. Reason
    - Restaurant settings allow disabling stock tracking, categories, and images
    - When these features are disabled, products should still be creatable without these fields
    - This prevents NOT NULL constraint violations
*/

-- Make stock_quantity nullable and remove NOT NULL constraint
ALTER TABLE products 
ALTER COLUMN stock_quantity DROP NOT NULL;

-- Set default to NULL instead of 0 for consistency
ALTER TABLE products 
ALTER COLUMN stock_quantity SET DEFAULT NULL;

-- Make category_id nullable if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;
  END IF;
END $$;

-- Make image_url nullable if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ALTER COLUMN image_url DROP NOT NULL;
  END IF;
END $$;