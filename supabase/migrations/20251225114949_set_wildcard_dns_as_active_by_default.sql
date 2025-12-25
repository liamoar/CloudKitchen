/*
  # Set Wildcard DNS as Active by Default

  This migration updates the default values for subdomain and SSL flags since
  wildcard DNS is configured in Vercel. All new businesses will have their
  subdomains active immediately.

  ## Changes Made
  1. Set `is_subdomain_active` default to true
  2. Set `is_ssl_added` default to true
  3. Update existing businesses to have these flags enabled

  ## Reasoning
  - Wildcard DNS (*.hejo.app) is configured in Vercel
  - SSL certificates are automatically provisioned by Vercel
  - No manual DNS configuration or SSL setup is required
  - Subdomains work immediately upon creation
*/

-- Update default values for new businesses
ALTER TABLE businesses 
  ALTER COLUMN is_subdomain_active SET DEFAULT true,
  ALTER COLUMN is_ssl_added SET DEFAULT true;

-- Update existing businesses to enable subdomain and SSL
UPDATE businesses 
SET 
  is_subdomain_active = true,
  is_ssl_added = true
WHERE 
  is_subdomain_active = false 
  OR is_ssl_added = false;
