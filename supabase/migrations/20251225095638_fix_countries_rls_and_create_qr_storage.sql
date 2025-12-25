/*
  # Fix Countries RLS and Create QR Code Storage

  1. Changes
    - Fix RLS policy for countries table to allow INSERT with WITH CHECK clause
    - Create storage bucket for country QR codes
    - Add storage policies for QR code uploads

  2. Security
    - Super admins can upload/manage QR codes
    - QR codes are publicly viewable
*/

-- Drop existing policy and recreate with WITH CHECK
DROP POLICY IF EXISTS "Superadmins can manage countries" ON countries;

CREATE POLICY "Superadmins can manage countries"
  ON countries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('country-qr-codes', 'country-qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for QR codes
CREATE POLICY "Public can view QR codes"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'country-qr-codes');

CREATE POLICY "Superadmins can upload QR codes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'country-qr-codes'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Superadmins can update QR codes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'country-qr-codes'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Superadmins can delete QR codes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'country-qr-codes'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );
