/*
  # Auto-create Business Settings with Default Hours
  
  1. Changes
    - Create trigger to automatically insert business_settings when a business is created
    - Default opening hours: 8:00 AM to 10:00 PM for all days
    - Copy city and address from business registration
  
  2. Default Operating Hours Structure
    ```json
    {
      "monday": {"open": "08:00", "close": "22:00", "is_closed": false},
      "tuesday": {"open": "08:00", "close": "22:00", "is_closed": false},
      "wednesday": {"open": "08:00", "close": "22:00", "is_closed": false},
      "thursday": {"open": "08:00", "close": "22:00", "is_closed": false},
      "friday": {"open": "08:00", "close": "22:00", "is_closed": false},
      "saturday": {"open": "08:00", "close": "22:00", "is_closed": false},
      "sunday": {"open": "08:00", "close": "22:00", "is_closed": false}
    }
    ```
*/

-- Add city and address columns to businesses table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'city'
  ) THEN
    ALTER TABLE businesses ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'address'
  ) THEN
    ALTER TABLE businesses ADD COLUMN address text;
  END IF;
END $$;

-- Create function to auto-create business settings with defaults
CREATE OR REPLACE FUNCTION create_default_business_settings()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  default_hours jsonb;
BEGIN
  -- Define default opening hours (8am-10pm for all days)
  default_hours := jsonb_build_object(
    'monday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false),
    'tuesday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false),
    'wednesday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false),
    'thursday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false),
    'friday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false),
    'saturday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false),
    'sunday', jsonb_build_object('open', '08:00', 'close', '22:00', 'is_closed', false)
  );

  -- Insert business settings with defaults
  INSERT INTO business_settings (
    business_id,
    address,
    city,
    opening_hours,
    show_product_images,
    enable_stock_management,
    enable_categories,
    minimum_order_value
  ) VALUES (
    NEW.id,
    NEW.address,
    NEW.city,
    default_hours,
    true,
    true,
    false,
    0
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_business_settings_on_insert ON businesses;

-- Create trigger to auto-create settings when business is created
CREATE TRIGGER create_business_settings_on_insert
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION create_default_business_settings();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_default_business_settings() TO authenticated;
