/*
  # Add Restaurant Public Information Fields

  1. New Columns
    - `support_email` (text, nullable) - Public-facing support email
    - `support_phone` (text, nullable) - Public-facing support phone number
    - `opening_time` (time, nullable) - Store opening time
    - `closing_time` (time, nullable) - Store closing time
    - `is_open_now` (boolean, default true) - Manual open/closed toggle
    - `operating_days` (text[], default all days) - Days of operation
  
  2. Changes
    - These fields are separate from owner login credentials
    - Used for public display on storefront
    - Nullable to allow gradual adoption
  
  3. Security
    - All fields are publicly readable via RLS policies
    - Only restaurant owners can update their own restaurant info
*/

-- Add support contact fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'support_email'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN support_email text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'support_phone'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN support_phone text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'opening_time'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN opening_time time;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'closing_time'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN closing_time time;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'is_open_now'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN is_open_now boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'operating_days'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN operating_days text[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  END IF;
END $$;

COMMENT ON COLUMN restaurants.support_email IS 'Public-facing support email displayed to customers';
COMMENT ON COLUMN restaurants.support_phone IS 'Public-facing support phone displayed to customers';
COMMENT ON COLUMN restaurants.opening_time IS 'Daily opening time';
COMMENT ON COLUMN restaurants.closing_time IS 'Daily closing time';
COMMENT ON COLUMN restaurants.is_open_now IS 'Manual toggle for open/closed status';
COMMENT ON COLUMN restaurants.operating_days IS 'Days of the week the restaurant operates';
