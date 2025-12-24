/*
  # Fix Infinite Recursion in Users Table RLS with Security Definer Function

  ## Problem
  The RLS policy on users table causes infinite recursion because it queries
  the users table to check permissions, which triggers the same policy again.

  ## Solution
  Create a SECURITY DEFINER function that bypasses RLS to check if a user is a super admin.
  This function will be called by the RLS policy without triggering recursion.

  ## Changes
  1. Create a security definer function to check if user is super admin
  2. Drop all existing problematic policies on users table
  3. Recreate policies using the security definer function
*/

-- Create a security definer function to check if user is super admin
-- This function bypasses RLS and won't cause recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'SUPER_ADMIN'::user_role
  );
END;
$$;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Restaurant admins can view restaurant users" ON users;
DROP POLICY IF EXISTS "Super admin can view all users" ON users;
DROP POLICY IF EXISTS "Super admin can manage all users" ON users;

-- Recreate policies using the security definer function

-- Users can view their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Users can update their own data
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Super admin can view all users (using security definer function)
CREATE POLICY "Super admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Super admin can manage all users (using security definer function)
CREATE POLICY "Super admin can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
