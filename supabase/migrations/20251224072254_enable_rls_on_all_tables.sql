/*
  # Enable RLS on All Tables

  1. Security Fix
    - Enable RLS on all tables that currently have it disabled
    - This prevents direct database access without proper policies
    - Essential for securing the multi-tenant SaaS platform

  2. Tables to Enable RLS On
    - users
    - addresses
    - products
    - bundles
    - bundle_products
    - offers
    - orders
    - order_items
    - restaurant_settings
    - product_categories
    - featured_products
    - restaurants
    - subscription_configs
    - payment_receipts

  3. Security Approach
    - RLS enabled on all tables
    - Policies use service role key validation at app level
    - Public access only for specific use cases (order tracking)
*/

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
