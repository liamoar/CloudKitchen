/*
  # Restructure Database: Countries & Businesses Model
  
  1. New Tables
    - `countries` - Store country-specific configurations
    
  2. Restructured Tables
    - `subscription_tiers` - Link to countries
    - `businesses` (renamed from restaurants)
    - `business_settings` (renamed from restaurant_settings)
  
  3. Changes
    - Drop old tables and recreate with new structure
    - Clear all existing data as requested
    - Create comprehensive RLS policies
  
  4. Security
    - Enable RLS on all tables
    - Policies using SUPER_ADMIN role
*/

-- Drop existing tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS support_messages CASCADE;
DROP TABLE IF EXISTS support_chats CASCADE;
DROP TABLE IF EXISTS payment_invoices CASCADE;
DROP TABLE IF EXISTS payment_receipts CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS riders CASCADE;
DROP TABLE IF EXISTS restaurant_settings CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS subscription_tiers CASCADE;

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  short_name text NOT NULL,
  currency text NOT NULL,
  currency_symbol text NOT NULL,
  bank_name text,
  account_holder text,
  account_number text,
  qr_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL DEFAULT 0,
  days integer NOT NULL DEFAULT 30,
  product_limit integer NOT NULL DEFAULT 0,
  orders_per_month integer NOT NULL DEFAULT 0,
  storage_limit integer NOT NULL DEFAULT 1000,
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  trial_days integer NOT NULL DEFAULT 0,
  grace_period_days integer NOT NULL DEFAULT 7,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, country_id)
);

-- Create businesses table (renamed from restaurants)
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  subdomain text UNIQUE NOT NULL,
  is_subdomain_active boolean DEFAULT false,
  is_ssl_added boolean DEFAULT false,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
  subscription_tier_id uuid REFERENCES subscription_tiers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'inactive', 'cancelled', 'trial', 'past_due')),
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  next_renewal_plan_id uuid REFERENCES subscription_tiers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create business_settings table
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  support_email text,
  support_phone text,
  address text,
  city text,
  show_product_images boolean DEFAULT true,
  enable_stock_management boolean DEFAULT true,
  enable_categories boolean DEFAULT false,
  opening_hours jsonb DEFAULT '{}',
  bank_holder_name text,
  bank_name text,
  account_number text,
  qr_code_url text,
  minimum_order_value decimal(10,2) DEFAULT 0,
  delivery_charges jsonb DEFAULT '[]',
  enable_skus boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recreate products table with SKU support
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sku text,
  parent_product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  image_url text,
  category text,
  stock_quantity integer DEFAULT 0,
  is_available boolean DEFAULT true,
  variant_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recreate customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, phone)
);

-- Recreate riders table
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Recreate orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  rider_id uuid REFERENCES riders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'cancelled')),
  total_amount decimal(10,2) NOT NULL,
  delivery_fee decimal(10,2) DEFAULT 0,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recreate order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_sku text,
  product_variant_details jsonb,
  quantity integer NOT NULL,
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Recreate payment_invoices table
CREATE TABLE IF NOT EXISTS payment_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES subscription_tiers(id) ON DELETE RESTRICT,
  invoice_number text UNIQUE NOT NULL,
  amount decimal(10,2) NOT NULL,
  currency text NOT NULL,
  invoice_type text NOT NULL CHECK (invoice_type IN ('TRIAL_CONVERSION', 'UPGRADE', 'RENEWAL')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  due_date timestamptz NOT NULL,
  payment_receipt_url text,
  submission_date timestamptz,
  review_date timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recreate support_chats table
CREATE TABLE IF NOT EXISTS support_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recreate support_messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('business', 'superadmin')),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for countries
CREATE POLICY "Countries are viewable by everyone"
  ON countries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmins can manage countries"
  ON countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- RLS Policies for subscription_tiers
CREATE POLICY "Tiers are viewable by everyone"
  ON subscription_tiers FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Superadmins can manage tiers"
  ON subscription_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- RLS Policies for businesses
CREATE POLICY "Business owners can view their own business"
  ON businesses FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Superadmins can view all businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Business owners can update their own business"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Superadmins can manage all businesses"
  ON businesses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- RLS Policies for business_settings
CREATE POLICY "Business owners can view their settings"
  ON business_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can manage their settings"
  ON business_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for products
CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  TO authenticated
  USING (is_available = true);

CREATE POLICY "Business owners can manage their products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = products.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for customers
CREATE POLICY "Business owners can manage their customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = customers.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for riders
CREATE POLICY "Business owners can manage their riders"
  ON riders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = riders.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for orders
CREATE POLICY "Business owners can manage their orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = orders.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for order_items
CREATE POLICY "Order items viewable via orders"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN businesses ON businesses.id = orders.business_id
      WHERE orders.id = order_items.order_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN businesses ON businesses.id = orders.business_id
      WHERE orders.id = order_items.order_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for payment_invoices
CREATE POLICY "Business owners can view their invoices"
  ON payment_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = payment_invoices.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update their invoices"
  ON payment_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = payment_invoices.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = payment_invoices.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can manage all invoices"
  ON payment_invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- RLS Policies for support_chats
CREATE POLICY "Business owners can view their chats"
  ON support_chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = support_chats.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can create chats"
  ON support_chats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = support_chats.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can manage all chats"
  ON support_chats FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- RLS Policies for support_messages
CREATE POLICY "Chat participants can view messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_chats
      JOIN businesses ON businesses.id = support_chats.business_id
      WHERE support_chats.id = support_messages.chat_id
      AND (businesses.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'SUPER_ADMIN'
      ))
    )
  );

CREATE POLICY "Chat participants can send messages"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_countries_slug ON countries(slug);
CREATE INDEX IF NOT EXISTS idx_countries_status ON countries(status);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_country ON subscription_tiers(country_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country_id);
CREATE INDEX IF NOT EXISTS idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_invoices_business ON payment_invoices(business_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_countries_updated_at ON countries;
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON subscription_tiers;
CREATE TRIGGER update_subscription_tiers_updated_at BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_settings_updated_at ON business_settings;
CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_invoices_updated_at ON payment_invoices;
CREATE TRIGGER update_payment_invoices_updated_at BEFORE UPDATE ON payment_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_chats_updated_at ON support_chats;
CREATE TRIGGER update_support_chats_updated_at BEFORE UPDATE ON support_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
