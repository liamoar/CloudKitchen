/*
  # Fix Auth Trigger Function

  ## Changes
  - Update the trigger function to handle edge cases better
  - Add better error handling and logging
  - Ensure proper role handling
*/

-- Drop and recreate the trigger function with better error handling
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

  -- Insert into users table
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
    user_role
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail auth user creation
  RAISE WARNING 'Error in handle_new_auth_user: %', SQLERRM;
  RETURN NEW;
END;
$$;
