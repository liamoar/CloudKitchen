/*
  # Create Payment Invoices System for Subscription Management

  1. New Tables
    - `payment_invoices`: Tracks all subscription payment invoices
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `tier_id` (uuid, references subscription_tiers)
      - `invoice_number` (text, unique): Auto-generated invoice number
      - `invoice_type` (text): 'TRIAL_CONVERSION', 'RENEWAL', 'UPGRADE'
      - `amount` (decimal): Invoice amount
      - `currency` (text): Invoice currency
      - `status` (text): 'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
      - `payment_receipt_url` (text): URL to uploaded receipt
      - `payment_date` (timestamptz): When payment was made
      - `submission_date` (timestamptz): When receipt was submitted
      - `review_date` (timestamptz): When super admin reviewed
      - `reviewed_by` (uuid, references users): Super admin who reviewed
      - `rejection_reason` (text): Reason if rejected
      - `due_date` (timestamptz): When payment is due
      - `billing_period_start` (timestamptz): Start of billing period
      - `billing_period_end` (timestamptz): End of billing period
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to restaurants table
    - `subscription_status` (text): 'TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED'
    - `current_tier_id` (uuid, references subscription_tiers)
    - `trial_ends_at` (timestamptz): When trial period ends
    - `subscription_starts_at` (timestamptz): When paid subscription started
    - `subscription_ends_at` (timestamptz): When current subscription ends
    - `next_billing_date` (timestamptz): Next billing date

  3. Security
    - Enable RLS on payment_invoices
    - Restaurant owners can view their own invoices
    - Restaurant owners can submit receipts for their pending invoices
    - Super admins can view and approve all invoices
*/

-- Create enum for invoice status
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for invoice type
DO $$ BEGIN
  CREATE TYPE invoice_type AS ENUM ('TRIAL_CONVERSION', 'RENEWAL', 'UPGRADE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for subscription status
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add subscription tracking columns to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'TRIAL',
ADD COLUMN IF NOT EXISTS current_tier_id UUID REFERENCES subscription_tiers(id),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Create payment_invoices table
CREATE TABLE IF NOT EXISTS payment_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('TRIAL_CONVERSION', 'RENEWAL', 'UPGRADE')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  payment_receipt_url TEXT,
  payment_date TIMESTAMPTZ,
  submission_date TIMESTAMPTZ,
  review_date TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_invoices ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_invoices_restaurant ON payment_invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_invoices_status ON payment_invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_invoices_due_date ON payment_invoices(due_date);

-- RLS Policies for payment_invoices

-- Restaurant owners can view their own invoices
CREATE POLICY "Restaurant owners can view own invoices"
  ON payment_invoices
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Restaurant owners can update their pending/rejected invoices (submit receipts)
CREATE POLICY "Restaurant owners can submit receipts"
  ON payment_invoices
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
    AND status IN ('PENDING', 'REJECTED')
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Super admins can view all invoices
CREATE POLICY "Super admins can view all invoices"
  ON payment_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Super admins can update invoices (approve/reject)
CREATE POLICY "Super admins can approve/reject invoices"
  ON payment_invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- System can insert invoices (for auto-generation)
CREATE POLICY "Allow insert for authenticated users"
  ON payment_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Function to generate unique invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  counter INT;
BEGIN
  counter := (SELECT COUNT(*) FROM payment_invoices) + 1;
  new_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(counter::TEXT, 6, '0');
  
  WHILE EXISTS (SELECT 1 FROM payment_invoices WHERE invoice_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(counter::TEXT, 6, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_invoice_updated_at ON payment_invoices;
CREATE TRIGGER payment_invoice_updated_at
  BEFORE UPDATE ON payment_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_invoice_updated_at();

-- Comments for documentation
COMMENT ON TABLE payment_invoices IS 'Tracks subscription payment invoices and their approval status';
COMMENT ON COLUMN payment_invoices.invoice_type IS 'Type: TRIAL_CONVERSION (first payment), RENEWAL (monthly), UPGRADE (plan change)';
COMMENT ON COLUMN payment_invoices.status IS 'PENDING: Created but not submitted, SUBMITTED: Receipt uploaded, UNDER_REVIEW: Being reviewed by admin, APPROVED: Payment approved, REJECTED: Payment rejected';
COMMENT ON COLUMN restaurants.subscription_status IS 'TRIAL: In trial period, ACTIVE: Paid subscription active, OVERDUE: Payment overdue but in grace period, SUSPENDED: Grace period ended';
COMMENT ON COLUMN restaurants.trial_ends_at IS 'When the trial period ends for this restaurant';
COMMENT ON COLUMN restaurants.next_billing_date IS 'Next date when payment is due';