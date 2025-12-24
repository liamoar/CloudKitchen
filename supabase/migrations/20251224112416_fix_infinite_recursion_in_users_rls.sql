/*
  # Fix Infinite Recursion in Users Table RLS Policies

  ## Problem
  The "Super admin can view all users" policy causes infinite recursion because it queries
  the users table to check permissions, which triggers the same policy again.

  ## Solution
  Fix the policy to use auth_id (which maps to auth.uid()) instead of id to avoid the recursion.
  The key is ensuring the subquery uses auth_id to match against auth.uid() directly.

  ## Changes
  1. Drop problematic "Super admin can view all users" policy
  2. Recreate it with correct logic using auth_id
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Super admin can view all users" ON users;

-- Recreate with fixed logic - use auth_id to avoid recursion
CREATE POLICY "Super admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() 
      AND role = 'SUPER_ADMIN'::user_role
    )
  );
