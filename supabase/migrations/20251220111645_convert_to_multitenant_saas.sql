/*
  # Convert to Multi-Tenant SaaS Architecture

  1. New Tables
    - `restaurants`
      - `id` (uuid, primary key)
      - `name` (text) - Restaurant name
      - `slug` (text, unique) - Unique URL identifier
      - `owner_id` (uuid) - Link to users table (restaurant owner)
      - `currency` (text) - Currency code (INR, NPR, USD, EUR, GBP, AED)
      - `country` (text) - Country for subscription config
      - `status` (enum) - ACTIVE, TRIAL, SUSPENDED, EXPIRED
      - `trial_end_date` (timestamptz) - When trial expires
      - `subscription_end_date` (timestamptz) - Current subscription end date
      - `is_payment_overdue` (boolean) - Whether payment is overdue
      - `overdue_since` (timestamptz) - When payment became overdue
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `subscription_configs`
      - `id` (uuid, primary key)
      - `country` (text, unique) - Country code
      - `currency` (text) - Currency for that country
      - `monthly_price` (numeric) - Subscription price per month
      - `trial_days` (integer) - Trial period in days
      - `overdue_grace_days` (integer) - Days before suspension after overdue
      - `created_at` (timestamptz)

    - `payment_receipts`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid) - Restaurant making payment
      - `amount` (numeric) - Payment amount
      - `currency` (text) - Currency of payment
      - `receipt_image_url` (text) - Uploaded receipt image
      - `status` (enum) - PENDING, APPROVED, REJECTED
      - `submitted_at` (timestamptz)
      - `reviewed_at` (timestamptz)
      - `reviewed_by` (uuid) - Super admin who reviewed
      - `notes` (text) - Admin notes
      - `created_at` (timestamptz)

  2. Schema Changes
    - Add `restaurant_id` to existing tables: products, product_categories, bundles, offers, featured_products, restaurant_settings
    - Update users table to add SUPER_ADMIN role
    - Make user_id nullable in some tables where restaurant_id is primary

  3. Enums
    - Create restaurant_status enum
    - Create payment_status enum
    - Update user_role enum to add SUPER_ADMIN
*/

-- Create enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restaurant_status') THEN
    CREATE TYPE restaurant_status AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- Update user_role enum to add SUPER_ADMIN
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES users(id),
  currency text DEFAULT 'USD',
  country text DEFAULT 'US',
  status restaurant_status DEFAULT 'TRIAL',
  trial_end_date timestamptz,
  subscription_end_date timestamptz,
  is_payment_overdue boolean DEFAULT false,
  overdue_since timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_configs table
CREATE TABLE IF NOT EXISTS subscription_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text UNIQUE NOT NULL,
  currency text NOT NULL,
  monthly_price numeric NOT NULL,
  trial_days integer DEFAULT 15,
  overdue_grace_days integer DEFAULT 2,
  created_at timestamptz DEFAULT now()
);

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL,
  receipt_image_url text,
  status payment_status DEFAULT 'PENDING',
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add restaurant_id to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE products ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_categories' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE product_categories ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bundles' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE bundles ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'offers' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE offers ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_products' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE featured_products ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurant_settings' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE restaurant_settings ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_restaurant_id ON payment_receipts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_restaurant_id ON product_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);

-- Insert default subscription configs
INSERT INTO subscription_configs (country, currency, monthly_price, trial_days, overdue_grace_days)
VALUES 
  ('AE', 'AED', 60, 15, 2),
  ('NP', 'NPR', 1500, 15, 2),
  ('IN', 'INR', 1200, 15, 2),
  ('US', 'USD', 20, 15, 2),
  ('GB', 'GBP', 15, 15, 2),
  ('EU', 'EUR', 18, 15, 2)
ON CONFLICT (country) DO NOTHING;
