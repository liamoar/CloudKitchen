/*
  # Fix Orders Schema for Customer Addresses

  1. Changes
    - Remove delivery_address from orders table (delivery info stored in customer_addresses)
    - Remove phone_number from orders (phone stored in customers table)
    - Remove user_id from orders (not needed - customers table handles identity)
    - Add delivery_notes column for special instructions
    - Add is_self_pickup boolean for pickup orders
    - Add payment_confirmed boolean
    - Ensure customer_addresses foreign key relationship exists

  2. Notes
    - Orders now reference customers table which contains phone
    - Delivery address retrieved via customer_addresses.customer_id relationship
    - This aligns with the multi-tenant customer model
*/

-- Drop columns that moved to customers/customer_addresses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivery_address'
  ) THEN
    ALTER TABLE orders DROP COLUMN delivery_address;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE orders DROP COLUMN phone_number;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders DROP COLUMN user_id;
  END IF;
END $$;

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivery_notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_notes text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'is_self_pickup'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_self_pickup boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_confirmed'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_confirmed boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_address_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_address_id uuid REFERENCES customer_addresses(id) ON DELETE SET NULL;
  END IF;
END $$;
