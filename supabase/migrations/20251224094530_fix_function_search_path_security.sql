/*
  # Fix Function Search Path Security Vulnerability

  1. Security Enhancement
    - Recreate `update_updated_at_column` function with immutable search_path
    - Prevents potential search_path manipulation attacks
    - Sets explicit search_path to ensure function always uses correct schema
  
  2. Changes
    - Adds `SET search_path = public` to the function definition
    - This makes the search_path immutable and prevents security vulnerabilities
    - Function behavior remains exactly the same, only security is enhanced
*/

-- Recreate the function with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
