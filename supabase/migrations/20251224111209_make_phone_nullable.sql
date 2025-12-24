/*
  # Make phone column nullable

  ## Changes
  - Make phone column nullable in users table since we now use email for authentication
  - Phone is now optional supplementary information
*/

ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
