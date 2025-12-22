/*
  # Add Subdomain Support for Multi-Tenant Restaurants

  ## Overview
  This migration adds subdomain-based routing support to replace path-based routing.
  Each restaurant will now have a unique subdomain (e.g., business1.domain.com).

  ## Changes
  
  1. Schema Changes
    - Add `subdomain` column to `restaurants` table (unique, required)
    - Keep `slug` for backward compatibility during transition
    - Add index on subdomain for fast lookups
  
  2. Data Migration
    - Copy existing slug values to subdomain field for existing restaurants
    - Ensure all subdomains are lowercase and valid
  
  3. Constraints
    - Subdomain must be unique across all restaurants
    - Subdomain format: alphanumeric and hyphens only, 3-63 characters
*/

-- Add subdomain column to restaurants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN subdomain text;
  END IF;
END $$;

-- Migrate existing slug data to subdomain (for existing restaurants)
UPDATE restaurants 
SET subdomain = LOWER(slug) 
WHERE subdomain IS NULL AND slug IS NOT NULL;

-- Make subdomain NOT NULL after migration
ALTER TABLE restaurants ALTER COLUMN subdomain SET NOT NULL;

-- Add unique constraint on subdomain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'restaurants_subdomain_unique'
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_subdomain_unique UNIQUE (subdomain);
  END IF;
END $$;

-- Add check constraint for subdomain format (alphanumeric and hyphens, 3-63 chars)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'restaurants_subdomain_format'
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_subdomain_format 
    CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$');
  END IF;
END $$;

-- Create index on subdomain for fast lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_subdomain ON restaurants(subdomain);

-- Add comment for documentation
COMMENT ON COLUMN restaurants.subdomain IS 'Unique subdomain for the restaurant (e.g., "business1" for business1.domain.com)';
