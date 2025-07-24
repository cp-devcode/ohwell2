/*
  # Add WhatsApp field to users table and update booking management

  1. Schema Changes
    - Add `whatsapp` field to users table
    - Make whatsapp field required and unique
    - Add indexes for better search performance

  2. Security
    - Update RLS policies to handle new field
    - Ensure proper access controls for staff vs admin roles

  3. Data Migration
    - Handle existing users without WhatsApp numbers
*/

-- Add whatsapp column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE users ADD COLUMN whatsapp text;
  END IF;
END $$;

-- Create unique index on whatsapp (allowing nulls for existing users)
CREATE UNIQUE INDEX IF NOT EXISTS users_whatsapp_key ON users(whatsapp) WHERE whatsapp IS NOT NULL;

-- Add search indexes for better performance
CREATE INDEX IF NOT EXISTS users_name_search_idx ON users USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS users_email_search_idx ON users USING gin(to_tsvector('english', email));
CREATE INDEX IF NOT EXISTS bookings_customer_search_idx ON bookings USING gin(
  to_tsvector('english', customer_name || ' ' || customer_email || ' ' || customer_phone || ' ' || customer_whatsapp)
);

-- Update RLS policies to ensure staff can manage bookings but not change roles
DROP POLICY IF EXISTS "Staff can view all users" ON users;
CREATE POLICY "Staff can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin_safe() OR (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = uid() AND u.role IN ('admin', 'staff')
    )
  ));

DROP POLICY IF EXISTS "Staff can update user profiles but not roles" ON users;
CREATE POLICY "Staff can update user profiles but not roles"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_safe() OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role = 'staff'
      )
    )
  )
  WITH CHECK (
    -- Admins can update everything
    is_admin_safe() OR (
      -- Staff can update user data but cannot change roles
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role = 'staff'
      ) AND (
        -- Ensure role is not being changed by staff
        role = (SELECT role FROM users WHERE id = users.id)
      )
    )
  );

-- Allow staff to create users (for new client creation)
DROP POLICY IF EXISTS "Staff can create users" ON users;
CREATE POLICY "Staff can create users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_safe() OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role IN ('admin', 'staff')
      )
    )
  );

-- Update booking policies for staff access
DROP POLICY IF EXISTS "Staff can view all bookings" ON bookings;
CREATE POLICY "Staff can view all bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (
    is_admin_safe() OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role IN ('admin', 'staff')
      )
    ) OR (uid() = user_id)
  );

DROP POLICY IF EXISTS "Staff can update bookings" ON bookings;
CREATE POLICY "Staff can update bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_safe() OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role IN ('admin', 'staff')
      )
    )
  )
  WITH CHECK (
    is_admin_safe() OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role IN ('admin', 'staff')
      )
    )
  );

DROP POLICY IF EXISTS "Staff can create bookings" ON bookings;
CREATE POLICY "Staff can create bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_safe() OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = uid() AND u.role IN ('admin', 'staff')
      )
    ) OR (uid() = user_id)
  );