/*
  # Sync Users Table IDs with Auth Users

  1. Problem
    - User IDs in the `users` table don't match IDs in `auth.users`
    - This breaks RLS policies that check `auth.uid()` against the `users` table
    - Super admin cannot create countries because RLS policy fails

  2. Solution
    - Temporarily disable foreign key constraints
    - Update all user IDs in the `users` table to match their `auth.users` IDs
    - Update all foreign key references in related tables
    - Re-enable constraints

  3. Security
    - No changes to RLS policies needed
    - Existing policies will work correctly after ID sync
*/

-- Create a temporary mapping table
CREATE TEMP TABLE user_id_mapping AS
SELECT 
  u.id as old_id,
  au.id as new_id,
  u.email
FROM users u
INNER JOIN auth.users au ON u.email = au.email;

-- Drop and recreate foreign key constraints to allow updates
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_owner_id_fkey;
ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;
ALTER TABLE customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_customer_id_fkey;
ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;
ALTER TABLE featured_products DROP CONSTRAINT IF EXISTS featured_products_user_id_fkey;
ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_user_id_fkey;

-- Update the users table IDs first
UPDATE users u
SET id = m.new_id
FROM user_id_mapping m
WHERE u.id = m.old_id;

-- Update foreign key references in businesses table
UPDATE businesses b
SET owner_id = m.new_id
FROM user_id_mapping m
WHERE b.owner_id = m.old_id;

-- Update foreign key references in addresses table
UPDATE addresses a
SET user_id = m.new_id
FROM user_id_mapping m
WHERE a.user_id = m.old_id;

-- Update foreign key references in customer_addresses table
UPDATE customer_addresses ca
SET customer_id = m.new_id
FROM user_id_mapping m
WHERE ca.customer_id = m.old_id;

-- Update foreign key references in support_messages table
UPDATE support_messages sm
SET sender_id = m.new_id
FROM user_id_mapping m
WHERE sm.sender_id = m.old_id;

-- Update foreign key references in featured_products table
UPDATE featured_products fp
SET user_id = m.new_id
FROM user_id_mapping m
WHERE fp.user_id = m.old_id;

-- Update foreign key references in product_categories table
UPDATE product_categories pc
SET user_id = m.new_id
FROM user_id_mapping m
WHERE pc.user_id = m.old_id;

-- Recreate foreign key constraints
ALTER TABLE businesses ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE support_messages ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE featured_products ADD CONSTRAINT featured_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE product_categories ADD CONSTRAINT product_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Verify the sync
DO $$
DECLARE
  mismatch_count INTEGER;
  synced_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM users u
  LEFT JOIN auth.users au ON u.id = au.id AND u.email = au.email
  WHERE au.id IS NULL;
  
  SELECT COUNT(*) INTO synced_count
  FROM users u
  INNER JOIN auth.users au ON u.id = au.id AND u.email = au.email;
  
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'ID sync verification failed: % mismatched records', mismatch_count;
  END IF;
  
  RAISE NOTICE 'ID sync completed successfully. % user records are now in sync with auth.users.', synced_count;
END $$;
