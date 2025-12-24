/*
  # Add Bank Details and QR Code Support

  1. Changes
    - Add bank details fields to restaurant_settings table
    - Add bank details fields to subscription_tiers table (country-level payment info)
    - These allow businesses to display their payment info to customers
    - Super admin can set country-level payment info for subscription payments

  2. New Fields in restaurant_settings
    - bank_name (text): Name of the bank
    - account_holder_name (text): Account holder name
    - account_number (text): Bank account number
    - bank_qr_code_url (text): URL to QR code image for bank transfers
    
  3. New Fields in subscription_tiers
    - country_bank_name (text): Bank name for subscription payments in this country
    - country_account_holder (text): Account holder for subscription payments
    - country_account_number (text): Account number for subscription payments
    - country_bank_qr_url (text): QR code for subscription payments

  4. Security
    - These are optional fields
    - Can be displayed to customers after order completion
*/

-- Add bank details to restaurant_settings
ALTER TABLE restaurant_settings 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_qr_code_url TEXT;

-- Add country-level bank details to subscription_tiers
ALTER TABLE subscription_tiers 
ADD COLUMN IF NOT EXISTS country_bank_name TEXT,
ADD COLUMN IF NOT EXISTS country_account_holder TEXT,
ADD COLUMN IF NOT EXISTS country_account_number TEXT,
ADD COLUMN IF NOT EXISTS country_bank_qr_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN restaurant_settings.bank_name IS 'Bank name for customer payments';
COMMENT ON COLUMN restaurant_settings.account_holder_name IS 'Account holder name for customer payments';
COMMENT ON COLUMN restaurant_settings.account_number IS 'Bank account number for customer payments';
COMMENT ON COLUMN restaurant_settings.bank_qr_code_url IS 'QR code URL for customer bank transfers';

COMMENT ON COLUMN subscription_tiers.country_bank_name IS 'Bank name for subscription payments in this country';
COMMENT ON COLUMN subscription_tiers.country_account_holder IS 'Account holder for subscription payments';
COMMENT ON COLUMN subscription_tiers.country_account_number IS 'Account number for subscription payments';
COMMENT ON COLUMN subscription_tiers.country_bank_qr_url IS 'QR code URL for subscription payments';