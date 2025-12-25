/*
  # Add Multi-SKU Product Variants System

  1. Changes
    - Add `enable_multiple_sku` boolean field to `business_settings` table
    - Create `product_variants` table for SKU management with:
      - Dynamic attributes stored as JSONB (e.g., {"color": "red", "size": "M"})
      - Individual price per variant
      - Individual stock tracking per variant (if enabled)
      - SKU code for each variant
    - Create `product_variant_images` table for SKU-specific images
    - Main product count remains 1 regardless of number of variants

  2. Design Principles
    - Flexible attribute system supports any business type (clothing, electronics, etc.)
    - Attributes are stored as key-value pairs in JSONB
    - Each variant can have its own images when image feature is enabled
    - Stock tracking works at variant level when enabled
    - Product limits count main products only, not individual variants

  3. Security
    - Enable RLS on all new tables
    - Business owners can manage their own product variants
    - Customers can view active variants for products
*/

-- Add enable_multiple_sku to business_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'enable_multiple_sku'
  ) THEN
    ALTER TABLE business_settings ADD COLUMN enable_multiple_sku boolean DEFAULT false;
  END IF;
END $$;

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_code text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  price decimal(10,2) NOT NULL,
  stock_quantity integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_business_id ON product_variants(business_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_attributes ON product_variants USING gin(attributes);

-- Create product_variant_images table
CREATE TABLE IF NOT EXISTS product_variant_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_images_variant_id ON product_variant_images(variant_id);

-- Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants

-- Business owners can view their variants
CREATE POLICY "Business owners can view their variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Business owners can insert variants
CREATE POLICY "Business owners can insert variants"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Business owners can update their variants
CREATE POLICY "Business owners can update their variants"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Business owners can delete their variants
CREATE POLICY "Business owners can delete their variants"
  ON product_variants FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Public can view active variants for active products
CREATE POLICY "Public can view active variants"
  ON product_variants FOR SELECT
  TO public
  USING (
    is_active = true
    AND product_id IN (
      SELECT id FROM products WHERE is_active = true
    )
  );

-- RLS Policies for product_variant_images

-- Business owners can manage variant images
CREATE POLICY "Business owners can manage variant images"
  ON product_variant_images FOR ALL
  TO authenticated
  USING (
    variant_id IN (
      SELECT id FROM product_variants
      WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    variant_id IN (
      SELECT id FROM product_variants
      WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Public can view variant images for active variants
CREATE POLICY "Public can view variant images"
  ON product_variant_images FOR SELECT
  TO public
  USING (
    variant_id IN (
      SELECT id FROM product_variants WHERE is_active = true
    )
  );

-- Function to update product variant timestamp
CREATE OR REPLACE FUNCTION update_product_variant_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update variant timestamp
DROP TRIGGER IF EXISTS update_product_variant_timestamp_trigger ON product_variants;
CREATE TRIGGER update_product_variant_timestamp_trigger
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_variant_timestamp();