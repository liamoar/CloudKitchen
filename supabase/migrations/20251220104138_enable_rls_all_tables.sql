/*
  # Enable Row Level Security for All Tables

  1. Security Changes
    - Enable RLS on all remaining tables without RLS
    - Create policies for secure data access
    - Ensure public can browse products/bundles
    - Protect user data and orders appropriately

  2. Tables Being Secured
    - users (enable RLS)
    - addresses (enable RLS)
    - products (enable RLS)
    - bundles (enable RLS)
    - bundle_products (enable RLS)
    - offers (enable RLS)
    - orders (enable RLS)
    - order_items (enable RLS)
*/

-- Enable RLS on tables that don't have it
DO $$
BEGIN
  -- Users
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Addresses
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'addresses' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Products
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'products' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Bundles
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'bundles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Bundle Products
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'bundle_products' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE bundle_products ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Offers
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'offers' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Orders
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Order Items
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'order_items' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies (with IF NOT EXISTS checks)

-- Users table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON users FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON users FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Addresses table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'addresses' AND policyname = 'Users can view own addresses'
  ) THEN
    CREATE POLICY "Users can view own addresses"
      ON addresses FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'addresses' AND policyname = 'Users can insert own addresses'
  ) THEN
    CREATE POLICY "Users can insert own addresses"
      ON addresses FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'addresses' AND policyname = 'Users can update own addresses'
  ) THEN
    CREATE POLICY "Users can update own addresses"
      ON addresses FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'addresses' AND policyname = 'Users can delete own addresses'
  ) THEN
    CREATE POLICY "Users can delete own addresses"
      ON addresses FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Products table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Anyone can view active products'
  ) THEN
    CREATE POLICY "Anyone can view active products"
      ON products FOR SELECT
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Admins can insert products'
  ) THEN
    CREATE POLICY "Admins can insert products"
      ON products FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Admins can update products'
  ) THEN
    CREATE POLICY "Admins can update products"
      ON products FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Admins can delete products'
  ) THEN
    CREATE POLICY "Admins can delete products"
      ON products FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- Bundles table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bundles' AND policyname = 'Anyone can view active bundles'
  ) THEN
    CREATE POLICY "Anyone can view active bundles"
      ON bundles FOR SELECT
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bundles' AND policyname = 'Admins can insert bundles'
  ) THEN
    CREATE POLICY "Admins can insert bundles"
      ON bundles FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bundles' AND policyname = 'Admins can update bundles'
  ) THEN
    CREATE POLICY "Admins can update bundles"
      ON bundles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bundles' AND policyname = 'Admins can delete bundles'
  ) THEN
    CREATE POLICY "Admins can delete bundles"
      ON bundles FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- Bundle products table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bundle_products' AND policyname = 'Anyone can view bundle products'
  ) THEN
    CREATE POLICY "Anyone can view bundle products"
      ON bundle_products FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bundle_products' AND policyname = 'Admins can manage bundle products'
  ) THEN
    CREATE POLICY "Admins can manage bundle products"
      ON bundle_products FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- Offers table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'Anyone can view active offers'
  ) THEN
    CREATE POLICY "Anyone can view active offers"
      ON offers FOR SELECT
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'offers' AND policyname = 'Admins can manage offers'
  ) THEN
    CREATE POLICY "Admins can manage offers"
      ON offers FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- Orders table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Users can view own orders'
  ) THEN
    CREATE POLICY "Users can view own orders"
      ON orders FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins can view all orders'
  ) THEN
    CREATE POLICY "Admins can view all orders"
      ON orders FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Anyone can create orders'
  ) THEN
    CREATE POLICY "Anyone can create orders"
      ON orders FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins can update orders'
  ) THEN
    CREATE POLICY "Admins can update orders"
      ON orders FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;
END $$;

-- Order items table policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Users can view own order items'
  ) THEN
    CREATE POLICY "Users can view own order items"
      ON order_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admins can view all order items'
  ) THEN
    CREATE POLICY "Admins can view all order items"
      ON order_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role IN ('RESTRO_OWNER', 'SUPER_ADMIN')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Anyone can insert order items'
  ) THEN
    CREATE POLICY "Anyone can insert order items"
      ON order_items FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;