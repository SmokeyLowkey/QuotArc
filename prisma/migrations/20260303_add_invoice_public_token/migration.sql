-- Add public_token to invoices for permanent customer-facing pay URLs
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices (public_token);
