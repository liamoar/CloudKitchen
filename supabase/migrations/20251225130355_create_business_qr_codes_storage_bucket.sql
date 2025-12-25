/*
  # Create Business QR Codes Storage Bucket

  1. Changes
    - Create storage bucket for business bank QR codes
    - Add storage policies for QR code uploads

  2. Security
    - Business owners can upload/update their own QR codes
    - QR codes are publicly viewable (needed for customer checkout)
*/

-- Create storage bucket for business QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-qr-codes', 'business-qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for business QR codes
CREATE POLICY "Public can view business QR codes"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-qr-codes');

CREATE POLICY "Business owners can upload their QR codes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-qr-codes'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update their QR codes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-qr-codes'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete their QR codes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-qr-codes'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses
      WHERE owner_id = auth.uid()
    )
  );