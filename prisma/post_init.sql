-- QuotArc — Post-Migration SQL
-- Run this in Supabase SQL Editor AFTER `prisma migrate dev`
-- These features are Supabase-specific and can't be modeled in Prisma.

-- ============================================================
-- 0. LINK PROFILES TO AUTH.USERS
-- Prisma can't model cross-schema FKs, so we add it manually.
-- ============================================================

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 1. ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can only see/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Customers: users manage their own customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own customers" ON customers FOR ALL USING (auth.uid() = user_id);

-- Job Templates: globally readable
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates are public read" ON job_templates FOR SELECT USING (true);

ALTER TABLE job_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Template items are public read" ON job_template_items FOR SELECT USING (true);

-- Quotes: users manage their own quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quotes" ON quotes FOR ALL USING (auth.uid() = user_id);

-- Quote Line Items: access via parent quote ownership
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quote line items" ON quote_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_line_items.quote_id AND quotes.user_id = auth.uid())
  );

-- Invoices: users manage their own invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoices" ON invoices FOR ALL USING (auth.uid() = user_id);

-- Invoice Line Items: access via parent invoice ownership
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoice line items" ON invoice_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid())
  );

-- Activity Events: users can read their own; system can insert for anyone
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own events" ON activity_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert events" ON activity_events FOR INSERT WITH CHECK (true);

-- ============================================================
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, company_name, email_verified, verification_token, verification_expires)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
    false,
    encode(gen_random_bytes(32), 'hex'),
    now() + interval '24 hours'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_events;
