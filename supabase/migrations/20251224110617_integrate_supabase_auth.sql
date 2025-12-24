/*
  # Integrate Supabase Authentication

  ## Overview
  This migration integrates the application with Supabase's built-in authentication system,
  removing the insecure custom authentication implementation.

  ## Changes Made

  ### 1. Security Improvements
  - Remove `password` column from users table (storing plain text passwords is a critical security vulnerability)
  - Add `auth_id` column to link users table with Supabase auth.users table
  - Make `email` required and unique for authentication purposes
  - Keep `phone` as optional supplementary field

  ### 2. Schema Changes
  - Add `auth_id` UUID column (references auth.users.id)
  - Drop `password` column
  - Modify `email` to be NOT NULL and UNIQUE
  - Add constraint to ensure auth_id is unique

  ### 3. Automatic User Sync
  - Create trigger function to automatically create users table entry when auth user is created
  - Sync user metadata (role, name, phone) from auth.users.raw_user_meta_data

  ## Important Notes
  - All authentication now goes through Supabase Auth
  - Passwords are securely hashed by Supabase (not stored in plain text)
  - Users can sign in with email + password
  - Phone is stored as metadata, not used for authentication
  - User roles are stored in both users table and auth metadata for easy access
*/

-- Remove password column (security vulnerability)
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Add auth_id to link with Supabase auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make email required and unique for authentication
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add unique constraint on email if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Create function to automatically create users table entry when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (
    auth_id,
    email,
    name,
    phone,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CUSTOMER'::user_role)
  );
  RETURN NEW;
END;
$$;

-- Create trigger to sync auth.users to users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Update RLS policies to use auth.uid() instead of custom auth
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- Allow service role to manage all users (for admin operations)
DROP POLICY IF EXISTS "Service role can manage all users" ON users;
CREATE POLICY "Service role can manage all users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
