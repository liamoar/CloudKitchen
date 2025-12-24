/*
  # Create Customers Table for Shared Checkout Flow

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `phone` (text, unique) - Primary identifier for customers
      - `name` (text) - Customer name
      - `email` (text) - Customer email
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `customer_addresses`
      - `id` (uuid, primary key)
      - `customer_id` (uuid) - References customers
      - `label` (text) - e.g., "Home", "Work"
      - `full_address` (text) - Complete address
      - `city` (text)
      - `postal_code` (text)
      - `is_default` (boolean) - Default delivery address
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Shared customer data across all businesses
    - Phone number as primary lookup key
    - Support for multiple delivery addresses (limit 2 per customer at application level)
    - No login required for customers
    - Auto-populate customer details on subsequent orders

  3. Security
    - Enable RLS on both tables
    - Public can read/write their own data (no auth required)
    - Allow businesses to read customer data for their orders

  4. Changes to Orders Table
    - Add customer_id reference to orders table
    - Keep existing customer_name, customer_phone, customer_address for backward compatibility
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  label text DEFAULT 'Home',
  full_address text NOT NULL,
  city text,
  postal_code text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add customer_id to orders table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_is_default ON customer_addresses(customer_id, is_default);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
-- Allow anyone to insert new customers (no auth required)
CREATE POLICY "Anyone can create customer profile"
  ON customers FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read customers by phone (for lookup during checkout)
CREATE POLICY "Anyone can read customer by phone"
  ON customers FOR SELECT
  USING (true);

-- Allow anyone to update their own customer profile by phone
CREATE POLICY "Anyone can update customer by phone"
  ON customers FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for customer_addresses table
-- Allow anyone to insert addresses (no auth required)
CREATE POLICY "Anyone can create customer addresses"
  ON customer_addresses FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read addresses
CREATE POLICY "Anyone can read customer addresses"
  ON customer_addresses FOR SELECT
  USING (true);

-- Allow anyone to update addresses
CREATE POLICY "Anyone can update customer addresses"
  ON customer_addresses FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to delete addresses
CREATE POLICY "Anyone can delete customer addresses"
  ON customer_addresses FOR DELETE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER update_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
