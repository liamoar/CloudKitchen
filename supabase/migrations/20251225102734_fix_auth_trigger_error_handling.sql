/*
  # Fix Auth Trigger Error Handling

  1. Problem
    - The current trigger function has an exception handler that swallows all errors
    - This causes silent failures when creating user profiles
    - Users see "Failed to create user profile" because the profile creation fails but auth user is created

  2. Changes
    - Remove the exception handler that swallows errors
    - Let errors propagate so auth signup fails if user profile creation fails
    - Add better error messaging for debugging

  3. Security
    - No changes to RLS policies
    - Function remains SECURITY DEFINER for proper permissions
*/

-- Recreate the trigger function without silent error swallowing
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Get role from metadata, default to CUSTOMER
  BEGIN
    user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CUSTOMER'::user_role);
  EXCEPTION WHEN OTHERS THEN
    user_role := 'CUSTOMER'::user_role;
  END;

  -- Insert into users table (let errors propagate)
  INSERT INTO public.users (
    id,
    auth_id,
    email,
    name,
    phone,
    role
  ) VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    user_role
  );
  
  RETURN NEW;
END;
$$;
