/*
  # Fix RLS infinite recursion error

  1. Database Functions
    - Create a safe `is_admin()` function that doesn't cause recursion
    - Use auth.jwt() to check user role directly from JWT claims

  2. Security
    - Update RLS policies to use the corrected function
    - Ensure no circular dependencies in policy checks
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_admin();

-- Create a safe is_admin function that checks the JWT directly
-- This avoids querying the users table from within RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user has admin role in their JWT claims
  -- This is set when the user logs in and their profile is fetched
  RETURN COALESCE(
    (auth.jwt() ->> 'user_role')::text = 'admin',
    false
  );
END;
$$;

-- Alternative approach: Create a function that safely checks user role
-- without causing recursion by using a direct query with security definer
CREATE OR REPLACE FUNCTION get_user_role(user_uuid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  -- Return null if no user is authenticated
  IF user_uuid IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Query the users table directly with security definer privileges
  -- This bypasses RLS policies to avoid recursion
  SELECT role INTO user_role
  FROM public.users
  WHERE id = user_uuid;
  
  RETURN COALESCE(user_role, 'customer');
END;
$$;

-- Create a safe admin check function
CREATE OR REPLACE FUNCTION is_admin_safe()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$;

-- Update RLS policies for users table to avoid recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Create new policies using the safe function
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (is_admin_safe());

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Admins can insert users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_safe());

-- Update admin_notes policies
DROP POLICY IF EXISTS "Admins can manage all notes" ON public.admin_notes;

CREATE POLICY "Admins can manage all notes"
  ON public.admin_notes
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

-- Update user_activity_log policies
DROP POLICY IF EXISTS "Users can view their own activity" ON public.user_activity_log;
DROP POLICY IF EXISTS "Admins can manage all activity" ON public.user_activity_log;
DROP POLICY IF EXISTS "Users can insert their own activity" ON public.user_activity_log;

CREATE POLICY "Users can view their own activity"
  ON public.user_activity_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_admin_safe());

CREATE POLICY "Admins can manage all activity"
  ON public.user_activity_log
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Users can insert their own activity"
  ON public.user_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_admin_safe());