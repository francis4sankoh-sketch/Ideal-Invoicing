-- Ideal Invoicing — Initial Schema Migration
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  city text,
  state text,
  postcode text,
  notes text,
  portal_token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  photos text[] DEFAULT '{}',
  default_price numeric NOT NULL,
  gst_inclusive boolean DEFAULT false,
  category text,
  has_color_variants boolean DEFAULT false,
  color_variants jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- QUOTES
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  event_date date,
  event_location text,
  line_items jsonb DEFAULT '[]',
  photos text[] DEFAULT '{}',
  subtotal numeric DEFAULT 0,
  discount_type text,
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  include_gst boolean DEFAULT true,
  gst_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  deposit_percentage numeric DEFAULT 20,
  deposit_amount numeric DEFAULT 0,
  status text DEFAULT 'draft',
  valid_until date,
  notes text,
  terms text,
  converted_to_invoice boolean DEFAULT false,
  invoice_id uuid,
  view_history timestamptz[] DEFAULT '{}',
  last_viewed timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  event_date date,
  event_location text,
  line_items jsonb DEFAULT '[]',
  subtotal numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  deposit_percentage numeric DEFAULT 20,
  deposit_amount numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  payment_history jsonb DEFAULT '[]',
  status text DEFAULT 'unpaid',
  issue_date date,
  due_date date,
  paid_date date,
  payment_method text,
  notes text,
  last_reminder_sent date,
  view_history timestamptz[] DEFAULT '{}',
  last_viewed timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key for quotes.invoice_id after invoices table exists
ALTER TABLE quotes ADD CONSTRAINT fk_quotes_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ============================================
-- QUOTE MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS quote_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_name text,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  notes text,
  status text DEFAULT 'scheduled',
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  google_calendar_event_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- PURCHASE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE,
  supplier text NOT NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  items jsonb DEFAULT '[]',
  subtotal numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  status text DEFAULT 'draft',
  order_date date,
  expected_delivery date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  receipt_url text,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  title text,
  line_items jsonb DEFAULT '[]',
  discount_type text,
  discount_value numeric,
  notes text,
  terms text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- BUSINESS SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text DEFAULT 'Ideal Events Group',
  abn text,
  logo_url text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postcode text,
  website text,
  default_payment_terms integer DEFAULT 14,
  default_quote_validity integer DEFAULT 30,
  default_terms text,
  quote_prefix text DEFAULT 'Q',
  invoice_prefix text DEFAULT 'INV',
  next_quote_number integer DEFAULT 1001,
  next_invoice_number integer DEFAULT 1001,
  brand_color text DEFAULT '#800020',
  accent_color text DEFAULT '#f3b8b7',
  font_family text DEFAULT 'Libre Baskerville',
  bank_name text,
  account_name text,
  bsb text,
  account_number text,
  bank_reference_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- WEBSITE ENQUIRIES
-- ============================================
CREATE TABLE IF NOT EXISTS website_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  event_type text,
  event_date date,
  event_location text,
  guest_count integer,
  selected_items jsonb DEFAULT '[]',
  additional_notes text,
  status text DEFAULT 'new',
  source text DEFAULT 'website',
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INSERT DEFAULT BUSINESS SETTINGS
-- ============================================
INSERT INTO business_settings (
  business_name, email, website, default_terms
) VALUES (
  'Ideal Events Group',
  'info@idealeventsgroup.com.au',
  'https://idealeventsgroup.com.au',
  'Payment is due within 14 days of invoice issue date. A 20% deposit is required to confirm your booking. Cancellations within 7 days of the event may forfeit the deposit. All prices are in Australian Dollars (AUD).'
) ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_enquiries ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything (single-user app)
CREATE POLICY "Authenticated users full access" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON quotes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON quote_messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON appointments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON purchase_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON business_settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON website_enquiries FOR ALL USING (auth.role() = 'authenticated');

-- Anonymous access for portal (customers viewing their own data via token)
CREATE POLICY "Portal access via token" ON customers FOR SELECT USING (true);
CREATE POLICY "Portal access quotes" ON quotes FOR SELECT USING (true);
CREATE POLICY "Portal update quotes" ON quotes FOR UPDATE USING (true);
CREATE POLICY "Portal access invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Portal read messages" ON quote_messages FOR SELECT USING (true);
CREATE POLICY "Portal send messages" ON quote_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Portal read settings" ON business_settings FOR SELECT USING (true);

-- Public read access for products (website integration)
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);

-- Public insert for website enquiries
CREATE POLICY "Public insert enquiries" ON website_enquiries FOR INSERT WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_portal_token ON customers(portal_token);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_quote_messages_quote_id ON quote_messages(quote_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_website_enquiries_status ON website_enquiries(status);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER business_settings_updated_at BEFORE UPDATE ON business_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STORAGE BUCKETS (run in Supabase Dashboard > Storage)
-- ============================================
-- Create these buckets manually or via the Supabase Dashboard:
-- 1. "logos" - for business logos
-- 2. "products" - for product photos
-- 3. "quotes" - for quote line item photos
-- 4. "receipts" - for expense receipts
