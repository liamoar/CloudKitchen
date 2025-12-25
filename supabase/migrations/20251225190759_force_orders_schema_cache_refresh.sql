/*
  # Force Orders Table Schema Cache Refresh
  
  1. Purpose
    - Force PostgREST to reload the orders table schema
    - Fix "Could not find the 'delivery_address' column" error
    - This is a cache issue after removing columns
  
  2. Solution
    - Add a table comment to trigger schema reload
    - Send NOTIFY to pgrst for schema cache refresh
*/

-- Add/update table comment to force schema reload
COMMENT ON TABLE orders IS 'Customer orders with delivery and payment details (schema refreshed 2025-12-25)';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
