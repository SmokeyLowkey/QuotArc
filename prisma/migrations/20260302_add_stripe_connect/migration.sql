-- Add Stripe Connect fields to profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "stripe_onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

-- Add payment link fields to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_link" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_link_id" TEXT;
