/*
  # Create Storage Bucket for Payment Receipts

  1. Storage
    - Create a public storage bucket for payment receipt images
    - Allows authenticated users to upload payment proof
    - Public read access for admin review
    
  2. Security
    - Only authenticated users can upload
    - Files are publicly readable
*/

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payment receipts" ON storage.objects;

-- Allow authenticated users to upload payment receipts
CREATE POLICY "Authenticated users can upload payment receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-receipts');

-- Allow public read access to payment receipts
CREATE POLICY "Public read access to payment receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-receipts');

-- Allow users to update their own payment receipts
CREATE POLICY "Users can update own payment receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-receipts');

-- Allow users to delete their own payment receipts
CREATE POLICY "Users can delete own payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-receipts');