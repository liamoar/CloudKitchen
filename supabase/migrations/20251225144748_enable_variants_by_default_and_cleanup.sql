/*
  # Enable Variants by Default and Cleanup

  1. Changes
    - Set enable_multiple_sku to true by default for all existing businesses
    - Set enable_skus to true by default
    - Update default values for future inserts

  2. Notes
    - This ensures product variants are enabled for all businesses
    - Storefront will now show variant selection options
*/

-- Update existing business_settings to enable variants
UPDATE business_settings
SET 
  enable_multiple_sku = true,
  enable_skus = true
WHERE enable_multiple_sku IS NULL OR enable_multiple_sku = false;

-- Set default values for future inserts
ALTER TABLE business_settings 
ALTER COLUMN enable_multiple_sku SET DEFAULT true;

ALTER TABLE business_settings 
ALTER COLUMN enable_skus SET DEFAULT true;
