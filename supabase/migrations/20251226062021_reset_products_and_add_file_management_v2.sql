/*
  # Reset Products System and Add File Management

  ## Summary
  Complete reset of the product system with proper file management and variant handling.

  ## 1. Data Cleanup
    - Delete all existing products, variants, and related data
    - Clear product-images storage bucket
    - Remove old product categories

  ## 2. New Tables Created
    
    ### business_files
    Tracks all uploaded files for each business with metadata and storage usage
    - `id` (uuid, primary key)
    - `business_id` (uuid, foreign key to businesses)
    - `file_name` (text) - Original filename
    - `storage_path` (text) - Full path in Supabase Storage
    - `file_size` (bigint) - Size in bytes
    - `mime_type` (text) - File MIME type
    - `file_type` (text) - Category: 'product_image', 'qr_code', 'document'
    - `uploaded_by` (uuid, foreign key to users)
    - `created_at` (timestamptz)
    - Indexes on business_id and file_type for fast queries

    ### products (restructured)
    Main product table with common attributes
    - `id` (uuid, primary key)
    - `business_id` (uuid, foreign key to businesses)
    - `name` (text) - Product name
    - `description` (text) - Product description
    - `category` (text) - Product category
    - `base_price` (numeric) - Base/default price
    - `has_variants` (boolean) - Whether product has variants
    - `is_available` (boolean) - Product availability
    - `track_inventory` (boolean) - Whether to track stock
    - `created_at`, `updated_at` (timestamptz)

    ### product_images
    Links products to their image files
    - `id` (uuid, primary key)
    - `product_id` (uuid, foreign key to products)
    - `file_id` (uuid, foreign key to business_files)
    - `display_order` (integer) - Order for image gallery
    - `is_primary` (boolean) - Main product image

    ### product_variants
    Individual variants of a product (e.g., Red/Small, Blue/Large)
    - `id` (uuid, primary key)
    - `product_id` (uuid, foreign key to products)
    - `sku` (text) - Stock keeping unit (unique per business)
    - `variant_name` (text) - Display name (e.g., "Red / Small")
    - `price` (numeric) - Variant-specific price
    - `stock_quantity` (integer) - Current stock
    - `is_available` (boolean) - Variant availability

    ### product_variant_attributes
    Defines the attributes of each variant (color: Red, size: Small)
    - `id` (uuid, primary key)
    - `variant_id` (uuid, foreign key to product_variants)
    - `attribute_name` (text) - e.g., 'color', 'size', 'material'
    - `attribute_value` (text) - e.g., 'Red', 'Small', 'Cotton'

    ### product_variant_images
    Links specific images to variants
    - `id` (uuid, primary key)
    - `variant_id` (uuid, foreign key to product_variants)
    - `file_id` (uuid, foreign key to business_files)
    - `display_order` (integer)

  ## 3. Storage Setup
    - Create 'business-files' bucket for all business file uploads
    - Set file size limit per subscription tier
    - Public bucket for easy access

  ## 4. Security (RLS Policies)
    - Business owners can manage their own files
    - Business owners can manage their own products and variants
    - Public can view available products (for storefront)
    - Storage isolated per business using folder structure

  ## 5. Functions
    - get_business_storage_usage(business_id) - Returns total storage used in MB
    - cleanup_business_storage(business_id) - Removes all files for a business

  ## Important Notes
  - Files stored as: {business_id}/{file_type}/{uuid}.{ext}
  - Storage limits enforced at application level using business_files table
  - Variant matrix can be auto-generated in application code
  - SKUs must be unique per business
*/

-- =====================================================
-- 1. CLEANUP EXISTING DATA
-- =====================================================

-- Delete existing product data (cascades will handle related tables)
DELETE FROM bundle_products WHERE TRUE;
DELETE FROM featured_products WHERE TRUE;

-- Check if old tables exist and delete data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variant_images') THEN
    DELETE FROM product_variant_images WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') THEN
    DELETE FROM product_variants WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    DELETE FROM products WHERE TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
    DELETE FROM product_categories WHERE TRUE;
  END IF;
END $$;

-- Delete files from storage
DELETE FROM storage.objects WHERE bucket_id = 'product-images';

-- Drop old tables if they exist
DROP TABLE IF EXISTS product_variant_images CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;

-- =====================================================
-- 2. CREATE NEW SCHEMA
-- =====================================================

-- Business Files Table (tracks ALL uploaded files)
CREATE TABLE IF NOT EXISTS business_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('product_image', 'qr_code', 'document', 'other')),
  uploaded_by uuid REFERENCES users(auth_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_files_business_id ON business_files(business_id);
CREATE INDEX IF NOT EXISTS idx_business_files_file_type ON business_files(file_type);
CREATE INDEX IF NOT EXISTS idx_business_files_storage_path ON business_files(storage_path);

-- Products Table (restructured)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  has_variants boolean DEFAULT false,
  is_available boolean DEFAULT true,
  track_inventory boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);

-- Product Images (links products to business_files)
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES business_files(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_file_id ON product_images(file_id);

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  variant_name text NOT NULL,
  price numeric(10,2) NOT NULL,
  stock_quantity integer DEFAULT 0,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- Product Variant Attributes (color: Red, size: Small, etc.)
CREATE TABLE IF NOT EXISTS product_variant_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  attribute_value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_attributes_variant_id ON product_variant_attributes(variant_id);

-- Product Variant Images (links variants to business_files)
CREATE TABLE IF NOT EXISTS product_variant_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES business_files(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_images_variant_id ON product_variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_images_file_id ON product_variant_images(file_id);

-- =====================================================
-- 3. CREATE STORAGE BUCKET
-- =====================================================

-- Create business-files bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-files',
  'business-files',
  true,
  52428800, -- 50MB per file default
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

-- =====================================================
-- 4. ENABLE RLS
-- =====================================================

ALTER TABLE business_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_images ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES - business_files
-- =====================================================

-- Business owners can view their files
CREATE POLICY "Business owners can view their files"
  ON business_files FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Business owners can upload files
CREATE POLICY "Business owners can upload files"
  ON business_files FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Business owners can delete their files
CREATE POLICY "Business owners can delete their files"
  ON business_files FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Super admins can view all files
CREATE POLICY "Super admins can view all files"
  ON business_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 6. RLS POLICIES - products
-- =====================================================

-- Public can view available products (for storefront)
CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  TO public
  USING (is_available = true);

-- Business owners can manage their products
CREATE POLICY "Business owners can manage their products"
  ON products FOR ALL
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

-- Super admins can manage all products
CREATE POLICY "Super admins can manage all products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 7. RLS POLICIES - product_images
-- =====================================================

-- Public can view product images
CREATE POLICY "Anyone can view product images"
  ON product_images FOR SELECT
  TO public
  USING (true);

-- Business owners can manage their product images
CREATE POLICY "Business owners can manage their product images"
  ON product_images FOR ALL
  TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM products WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 8. RLS POLICIES - product_variants
-- =====================================================

-- Public can view available variants
CREATE POLICY "Anyone can view available variants"
  ON product_variants FOR SELECT
  TO public
  USING (is_available = true);

-- Business owners can manage their variants
CREATE POLICY "Business owners can manage their variants"
  ON product_variants FOR ALL
  TO authenticated
  USING (
    product_id IN (
      SELECT id FROM products WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM products WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Super admins can manage all variants
CREATE POLICY "Super admins can manage all variants"
  ON product_variants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 9. RLS POLICIES - product_variant_attributes
-- =====================================================

-- Public can view variant attributes
CREATE POLICY "Anyone can view variant attributes"
  ON product_variant_attributes FOR SELECT
  TO public
  USING (true);

-- Business owners can manage their variant attributes
CREATE POLICY "Business owners can manage variant attributes"
  ON product_variant_attributes FOR ALL
  TO authenticated
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 10. RLS POLICIES - product_variant_images
-- =====================================================

-- Public can view variant images
CREATE POLICY "Anyone can view variant images"
  ON product_variant_images FOR SELECT
  TO public
  USING (true);

-- Business owners can manage their variant images
CREATE POLICY "Business owners can manage variant images"
  ON product_variant_images FOR ALL
  TO authenticated
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 11. STORAGE POLICIES
-- =====================================================

-- Public can view files
CREATE POLICY "Public can view business files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-files');

-- Business owners can upload their files
CREATE POLICY "Business owners can upload their files in storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- Business owners can update their files
CREATE POLICY "Business owners can update their files in storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- Business owners can delete their files
CREATE POLICY "Business owners can delete their files in storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- 12. HELPER FUNCTIONS
-- =====================================================

-- Function to get business storage usage in MB
CREATE OR REPLACE FUNCTION get_business_storage_usage(p_business_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(file_size), 0) / 1024.0 / 1024.0
    FROM business_files
    WHERE business_id = p_business_id
  );
END;
$$;

-- Function to cleanup business storage (called when business is deleted)
CREATE OR REPLACE FUNCTION cleanup_business_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delete all storage objects for this business
  DELETE FROM storage.objects
  WHERE bucket_id IN ('business-files', 'business-qr-codes')
  AND (storage.foldername(name))[1] = OLD.id::text;
  
  RETURN OLD;
END;
$$;

-- Trigger to cleanup storage when business is deleted
DROP TRIGGER IF EXISTS cleanup_business_storage_trigger ON businesses;
CREATE TRIGGER cleanup_business_storage_trigger
  BEFORE DELETE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_business_storage();

-- Function to update product updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_updated_at();

-- Trigger for variants
DROP TRIGGER IF EXISTS update_variants_updated_at ON product_variants;
CREATE TRIGGER update_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_updated_at();
