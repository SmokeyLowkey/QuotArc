-- QuotArc MVP — Supabase Schema
-- Run this in the Supabase SQL Editor

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  company_name text NOT NULL,
  phone text,
  address text,
  license_number text,
  logo_url text,
  default_tax_rate numeric(5,4) DEFAULT 0.05,
  default_labor_rate numeric(8,2) DEFAULT 95.00,
  follow_up_template text DEFAULT 'Hi {customer_name}, just following up on the quote I sent for {job_type}. Let me know if you have any questions.',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  province text,
  property_notes text,
  panel_size text,
  service_amps text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own customers" ON customers FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_customers_user ON customers(user_id);

-- ============================================================
-- JOB TEMPLATES (global, read-only for users)
-- ============================================================
CREATE TABLE job_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text NOT NULL,
  labor_hours_min numeric(4,1),
  labor_hours_max numeric(4,1),
  price_range_min numeric(10,2),
  price_range_max numeric(10,2),
  sort_order integer DEFAULT 0
);

ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates are public read" ON job_templates FOR SELECT USING (true);

CREATE TABLE job_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('material', 'labor', 'permit', 'other')),
  default_qty numeric(8,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  price_range_low numeric(10,2),
  price_range_high numeric(10,2),
  is_conditional boolean DEFAULT false,
  condition_note text,
  sort_order integer DEFAULT 0
);

ALTER TABLE job_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Template items are public read" ON job_template_items FOR SELECT USING (true);

-- ============================================================
-- QUOTES
-- ============================================================
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  quote_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','accepted','expired')),
  job_type text NOT NULL,
  scope_notes text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0.05,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  auto_follow_up boolean DEFAULT true,
  follow_up_days integer DEFAULT 3,
  follow_up_count integer DEFAULT 0,
  customer_note text,
  code_notes jsonb,
  public_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  delivery_status text DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','delivered','failed')),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  expired_at timestamptz,
  next_follow_up timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quotes" ON quotes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_quotes_user_status ON quotes(user_id, status);
CREATE INDEX idx_quotes_public_token ON quotes(public_token);
CREATE INDEX idx_quotes_follow_up ON quotes(status, sent_at) WHERE auto_follow_up = true;

-- ============================================================
-- QUOTE LINE ITEMS (separate table, not JSONB)
-- ============================================================
CREATE TABLE quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'material',
  quantity numeric(8,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  rate numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  is_template_item boolean DEFAULT false,
  sort_order integer DEFAULT 0
);

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quote line items" ON quote_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_line_items.quote_id AND quotes.user_id = auth.uid())
  );

CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  quote_id uuid REFERENCES quotes(id),
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','overdue')),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0.05,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  sent_at timestamptz,
  paid_at timestamptz,
  due_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoices" ON invoices FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_invoices_user_status ON invoices(user_id, status);

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'material',
  quantity numeric(8,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ea',
  rate numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice line items" ON invoice_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())
  );

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================================
-- ACTIVITY EVENTS (powers the real-time feed)
-- ============================================================
CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'quote_sent','quote_viewed','quote_follow_up',
      'quote_accepted','quote_expired',
      'invoice_sent','invoice_paid','invoice_reminder'
    )),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own events" ON activity_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert events" ON activity_events FOR INSERT WITH CHECK (true);

CREATE INDEX idx_activity_events_user ON activity_events(user_id, created_at DESC);

-- ============================================================
-- Enable Realtime for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;
