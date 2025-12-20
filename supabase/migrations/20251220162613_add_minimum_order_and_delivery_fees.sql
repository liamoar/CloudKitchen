/*
  # Add Minimum Order Amount and Delivery Fee Tiers

  1. Changes
    - Add `minimum_order_amount` column to restaurants table
      Default: 0 (no minimum)
    - Add `delivery_fee_tiers` column to restaurants table (JSONB)
      Stores tiered delivery fees based on order amount
      Format: [
        { "min_amount": 0, "max_amount": 30, "fee": 8 },
        { "min_amount": 30, "max_amount": 50, "fee": 5 },
        { "min_amount": 50, "max_amount": null, "fee": 0 }
      ]
    - Add `delivery_fee` column to orders table
      Stores the calculated delivery fee for each order
  
  2. Notes
    - Minimum order amount is in the restaurant's currency
    - Delivery fee tiers are flexible and configurable per restaurant
    - null max_amount means "and above"
*/

-- Add minimum order amount to restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS minimum_order_amount numeric DEFAULT 0;

-- Add delivery fee tiers configuration to restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS delivery_fee_tiers jsonb DEFAULT '[]'::jsonb;

-- Add delivery fee to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;

-- Update restaurants table to also store currency
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS restaurant_currency text DEFAULT 'AED';
