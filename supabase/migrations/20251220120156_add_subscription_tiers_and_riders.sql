/*
  # Add Subscription Tiers, Delivery Riders, and Order Tracking

  1. New Tables
    - `subscription_tiers`
      - `id` (uuid, primary key)
      - `name` (text) - Tier name (Basic, Premium)
      - `country` (text) - Country code
      - `monthly_price` (numeric) - Price per month
      - `product_limit` (integer) - Max products allowed
      - `order_limit_per_month` (integer) - Max orders per month
      - `storage_limit_mb` (integer) - Storage limit in MB
      - `features` (jsonb) - Additional features
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `delivery_riders`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid) - Restaurant this rider belongs to
      - `name` (text)
      - `phone` (text)
      - `email` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `order_tracking_tokens`
      - `id` (uuid, primary key)
      - `order_id` (uuid) - Order being tracked
      - `token` (text, unique) - Tracking token
      - `token_type` (enum) - CUSTOMER or RIDER
      - `expires_at` (timestamptz) - Expiry time
      - `created_at` (timestamptz)

  2. Schema Changes
    - Add `tier_id` to restaurants table
    - Add `rider_id` to orders table
    - Update order status enum with new statuses
    - Add `is_self_pickup` to orders table
    - Add `tracking_url_expiry_hours` to restaurant_settings
    - Add usage tracking columns to restaurants

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies
*/

-- Create enum for tracking token types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_token_type') THEN
    CREATE TYPE tracking_token_type AS ENUM ('CUSTOMER', 'RIDER');
  END IF;
END $$;

-- Update order status enum with new statuses
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RETURNED';
END $$;

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  monthly_price numeric NOT NULL,
  product_limit integer NOT NULL,
  order_limit_per_month integer NOT NULL,
  storage_limit_mb integer NOT NULL,
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, country)
);

-- Create delivery_riders table
CREATE TABLE IF NOT EXISTS delivery_riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create order_tracking_tokens table
CREATE TABLE IF NOT EXISTS order_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  token_type tracking_token_type NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add tier_id to restaurants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'tier_id'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN tier_id uuid REFERENCES subscription_tiers(id);
  END IF;
END $$;

-- Add usage tracking columns to restaurants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'current_month_orders'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN current_month_orders integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'current_product_count'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN current_product_count integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'storage_used_mb'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN storage_used_mb numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'limits_exceeded'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN limits_exceeded boolean DEFAULT false;
  END IF;
END $$;

-- Add rider_id to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'rider_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_id uuid REFERENCES delivery_riders(id);
  END IF;
END $$;

-- Add is_self_pickup to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'is_self_pickup'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_self_pickup boolean DEFAULT false;
  END IF;
END $$;

-- Add tracking_url_expiry_hours to restaurant_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurant_settings' AND column_name = 'tracking_url_expiry_hours'
  ) THEN
    ALTER TABLE restaurant_settings ADD COLUMN tracking_url_expiry_hours integer DEFAULT 2;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_country ON subscription_tiers(country);
CREATE INDEX IF NOT EXISTS idx_delivery_riders_restaurant_id ON delivery_riders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_tokens_order_id ON order_tracking_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_tokens_token ON order_tracking_tokens(token);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_tiers
CREATE POLICY "Super admin can manage subscription tiers"
  ON subscription_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Anyone can view active subscription tiers"
  ON subscription_tiers FOR SELECT
  USING (is_active = true);

-- RLS Policies for delivery_riders
CREATE POLICY "Restaurant owners can view own riders"
  ON delivery_riders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = delivery_riders.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can insert own riders"
  ON delivery_riders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = delivery_riders.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can update own riders"
  ON delivery_riders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = delivery_riders.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = delivery_riders.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
  );

-- RLS Policies for order_tracking_tokens
CREATE POLICY "Public can view valid tracking tokens"
  ON order_tracking_tokens FOR SELECT
  USING (expires_at > now());

-- Insert default subscription tiers for UAE
INSERT INTO subscription_tiers (name, country, monthly_price, product_limit, order_limit_per_month, storage_limit_mb, features)
VALUES 
  ('Basic', 'AE', 60, 40, 600, 500, '{"support": "email", "customization": false}'),
  ('Premium', 'AE', 120, -1, -1, 2048, '{"support": "priority", "customization": true, "unlimited_products": true, "unlimited_orders": true}')
ON CONFLICT (name, country) DO NOTHING;

-- Insert default tiers for other countries
INSERT INTO subscription_tiers (name, country, monthly_price, product_limit, order_limit_per_month, storage_limit_mb, features)
VALUES 
  ('Basic', 'NP', 1500, 40, 600, 500, '{"support": "email", "customization": false}'),
  ('Premium', 'NP', 3000, -1, -1, 2048, '{"support": "priority", "customization": true}'),
  ('Basic', 'IN', 1200, 40, 600, 500, '{"support": "email", "customization": false}'),
  ('Premium', 'IN', 2400, -1, -1, 2048, '{"support": "priority", "customization": true}'),
  ('Basic', 'US', 20, 40, 600, 500, '{"support": "email", "customization": false}'),
  ('Premium', 'US', 40, -1, -1, 2048, '{"support": "priority", "customization": true}'),
  ('Basic', 'GB', 15, 40, 600, 500, '{"support": "email", "customization": false}'),
  ('Premium', 'GB', 30, -1, -1, 2048, '{"support": "priority", "customization": true}'),
  ('Basic', 'EU', 18, 40, 600, 500, '{"support": "email", "customization": false}'),
  ('Premium', 'EU', 36, -1, -1, 2048, '{"support": "priority", "customization": true}')
ON CONFLICT (name, country) DO NOTHING;

-- Update existing demo restaurant with Basic tier
UPDATE restaurants 
SET tier_id = (
  SELECT id FROM subscription_tiers 
  WHERE name = 'Basic' AND country = 'AE' 
  LIMIT 1
)
WHERE slug = 'r12345-delicious-bites';
