/*
  # Fix RLS policies for proper admin and staff access

  1. Security Updates
    - Fix admin access to all tables
    - Ensure staff can manage bookings and users appropriately
    - Add proper function for admin checking
    - Update all RLS policies to work correctly

  2. Functions
    - Create safe admin checking function
    - Update user management policies
*/

-- Create a safe function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_safe()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a safe function to check if user is staff or admin
CREATE OR REPLACE FUNCTION is_staff_or_admin_safe()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix users table RLS policies
DROP POLICY IF EXISTS "Admin can update users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Staff can create users" ON users;
DROP POLICY IF EXISTS "Staff can update user profiles but not roles" ON users;
DROP POLICY IF EXISTS "Staff can view all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new comprehensive policies for users table
CREATE POLICY "Admins can do everything with users"
  ON users
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Staff can view and update users (except roles)"
  ON users
  FOR ALL
  TO authenticated
  USING (is_staff_or_admin_safe())
  WITH CHECK (
    is_admin_safe() OR 
    (is_staff_or_admin_safe() AND (
      OLD.role IS NOT DISTINCT FROM NEW.role OR 
      OLD.role IS NULL
    ))
  );

CREATE POLICY "Users can view and update their own profile"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (OLD.role IS NOT DISTINCT FROM NEW.role OR OLD.role IS NULL));

-- Fix bookings table RLS policies
DROP POLICY IF EXISTS "Admins can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Allow booking creation for all users" ON bookings;
DROP POLICY IF EXISTS "Allow viewing bookings" ON bookings;
DROP POLICY IF EXISTS "Staff can create bookings" ON bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON bookings;
DROP POLICY IF EXISTS "Staff can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;

-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create new comprehensive policies for bookings table
CREATE POLICY "Admins can do everything with bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Staff can manage all bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (is_staff_or_admin_safe())
  WITH CHECK (is_staff_or_admin_safe());

CREATE POLICY "Users can view their own bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_staff_or_admin_safe());

CREATE POLICY "Users can create bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR is_staff_or_admin_safe());

CREATE POLICY "Users can update their own pending bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Public can create bookings without user_id"
  ON bookings
  FOR INSERT
  TO public
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Public can view bookings for availability"
  ON bookings
  FOR SELECT
  TO public
  USING (true);

-- Fix admin_notes table RLS policies
DROP POLICY IF EXISTS "Admins can manage all notes" ON admin_notes;

CREATE POLICY "Staff and admins can manage notes"
  ON admin_notes
  FOR ALL
  TO authenticated
  USING (is_staff_or_admin_safe())
  WITH CHECK (is_staff_or_admin_safe());

-- Fix user_activity_log table RLS policies
DROP POLICY IF EXISTS "Admins can manage all activity" ON user_activity_log;
DROP POLICY IF EXISTS "Users can insert their own activity" ON user_activity_log;
DROP POLICY IF EXISTS "Users can view their own activity" ON user_activity_log;

CREATE POLICY "Staff and admins can manage activity logs"
  ON user_activity_log
  FOR ALL
  TO authenticated
  USING (is_staff_or_admin_safe())
  WITH CHECK (is_staff_or_admin_safe());

CREATE POLICY "Users can view their own activity"
  ON user_activity_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_staff_or_admin_safe());

-- Fix other tables RLS policies
DROP POLICY IF EXISTS "Admins can manage workspace types" ON workspace_types;
DROP POLICY IF EXISTS "Anyone can view active workspace types" ON workspace_types;

CREATE POLICY "Staff and admins can manage workspace types"
  ON workspace_types
  FOR ALL
  TO authenticated
  USING (is_staff_or_admin_safe())
  WITH CHECK (is_staff_or_admin_safe());

CREATE POLICY "Anyone can view active workspace types"
  ON workspace_types
  FOR SELECT
  TO public
  USING (is_active = true);

-- Fix site_settings table RLS policies
DROP POLICY IF EXISTS "Admins can manage all settings" ON site_settings;
DROP POLICY IF EXISTS "Anyone can view public settings" ON site_settings;

CREATE POLICY "Admins can manage all settings"
  ON site_settings
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view public settings"
  ON site_settings
  FOR SELECT
  TO public
  USING (is_public = true);

-- Fix content_items table RLS policies
DROP POLICY IF EXISTS "Admins can manage all content" ON content_items;
DROP POLICY IF EXISTS "Anyone can view published content" ON content_items;

CREATE POLICY "Admins can manage all content"
  ON content_items
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view published content"
  ON content_items
  FOR SELECT
  TO public
  USING (is_published = true);

-- Fix team_members table RLS policies
DROP POLICY IF EXISTS "Admins can manage team members" ON team_members;
DROP POLICY IF EXISTS "Anyone can view active team members" ON team_members;

CREATE POLICY "Admins can manage team members"
  ON team_members
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view active team members"
  ON team_members
  FOR SELECT
  TO public
  USING (is_active = true);

-- Fix statistics table RLS policies
DROP POLICY IF EXISTS "Admins can manage statistics" ON statistics;
DROP POLICY IF EXISTS "Anyone can view active statistics" ON statistics;

CREATE POLICY "Admins can manage statistics"
  ON statistics
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view active statistics"
  ON statistics
  FOR SELECT
  TO public
  USING (is_active = true);

-- Fix pricing_plans table RLS policies
DROP POLICY IF EXISTS "Admins can manage pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Anyone can view active pricing plans" ON pricing_plans;

CREATE POLICY "Admins can manage pricing plans"
  ON pricing_plans
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view active pricing plans"
  ON pricing_plans
  FOR SELECT
  TO public
  USING (is_active = true);

-- Fix pricing_faqs table RLS policies
DROP POLICY IF EXISTS "Admins can manage pricing FAQs" ON pricing_faqs;
DROP POLICY IF EXISTS "Anyone can view active pricing FAQs" ON pricing_faqs;

CREATE POLICY "Admins can manage pricing FAQs"
  ON pricing_faqs
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view active pricing FAQs"
  ON pricing_faqs
  FOR SELECT
  TO public
  USING (is_active = true);

-- Fix media_files table RLS policies
DROP POLICY IF EXISTS "Admins can manage all media" ON media_files;
DROP POLICY IF EXISTS "Anyone can view public media" ON media_files;

CREATE POLICY "Admins can manage all media"
  ON media_files
  FOR ALL
  TO authenticated
  USING (is_admin_safe())
  WITH CHECK (is_admin_safe());

CREATE POLICY "Anyone can view public media"
  ON media_files
  FOR SELECT
  TO public
  USING (is_public = true);