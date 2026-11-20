-- Turn the app from one business into many.
--
-- Every row of business data now belongs to a business (organizations). A login belongs to one
-- business (organization_members), and the database only lets a login see and change its own
-- business's rows. Ideal Events Hire becomes the first business, and all existing data and the
-- existing login move into it, so nothing changes for Ideal.
--
-- Run this, then deploy the matching code straight away. The old code keeps working for Ideal in
-- the meantime, except website enquiries and portal messages, which fail until the new code is live.
--
-- Safe to run twice.

BEGIN;

-- ============================================
-- BUSINESSES AND THEIR LOGINS
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- The original business. Old links with no business in them (website enquiry secret, calendar
  -- feed key, files uploaded before this change) belong to it.
  is_default boolean NOT NULL DEFAULT false,
  -- Address this business's emails come from. Must be on a domain verified in Resend.
  -- Empty means the shared platform address (PLATFORM_FROM_EMAIL), with replies going to the business.
  email_from text,
  -- Secret the business's own website sends with enquiries (x-api-secret header).
  enquiry_api_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  -- Secret in the business's private calendar feed address.
  calendar_feed_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_default ON organizations (is_default) WHERE is_default;

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
-- One business per login for now.
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_business ON organization_members (user_id);

-- The signed-in login's business, or null. Used by every policy below and as the default
-- business for new rows, so the app's existing inserts land in the right business.
CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid() LIMIT 1
$$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their business" ON organizations;
CREATE POLICY "Members read their business" ON organizations
  FOR SELECT TO authenticated USING (id = public.current_org_id());
DROP POLICY IF EXISTS "Members read their own membership" ON organization_members;
CREATE POLICY "Members read their own membership" ON organization_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============================================
-- IDEAL EVENTS HIRE BECOMES THE FIRST BUSINESS
-- ============================================
DO $$
DECLARE
  ideal uuid;
  t text;
  pol record;
  business_tables text[] := ARRAY[
    'customers', 'products', 'quotes', 'invoices', 'quote_messages', 'appointments',
    'purchase_orders', 'expenses', 'templates', 'business_settings', 'website_enquiries'
  ];
BEGIN
  SELECT id INTO ideal FROM organizations WHERE is_default;
  IF ideal IS NULL THEN
    INSERT INTO organizations (name, is_default, email_from)
    VALUES (
      coalesce((SELECT business_name FROM business_settings ORDER BY created_at LIMIT 1), 'Ideal Events Hire'),
      true,
      'info@idealeventshire.com.au'
    )
    RETURNING id INTO ideal;
  END IF;

  -- Every existing login works for Ideal.
  INSERT INTO organization_members (organization_id, user_id, role)
  SELECT ideal, u.id, 'owner' FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id = u.id);

  FOREACH t IN ARRAY business_tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE %I SET organization_id = $1 WHERE organization_id IS NULL', t) USING ideal;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET DEFAULT public.current_org_id()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (organization_id)', 'idx_' || t || '_organization_id', t);

    -- Replace every old policy ("any logged-in user sees everything", public product reads,
    -- public enquiry inserts). Public access now goes through the app's server, which checks
    -- its own secrets and picks the business.
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Members manage their own business" ON %I FOR ALL TO authenticated '
      'USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id())',
      t
    );
  END LOOP;
END $$;

-- Quote, invoice and order numbers only need to be unique within a business.
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_org_quote_number ON quotes (organization_id, quote_number);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_org_invoice_number ON invoices (organization_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_order_number ON purchase_orders (organization_id, order_number);

-- One settings row per business, and no Ideal name on new ones.
CREATE UNIQUE INDEX IF NOT EXISTS business_settings_one_per_org ON business_settings (organization_id);
ALTER TABLE business_settings ALTER COLUMN business_name DROP DEFAULT;

-- ============================================
-- SIGN-UP: A NEW LOGIN CREATES ITS BUSINESS
-- ============================================
CREATE OR REPLACE FUNCTION public.create_organization(business_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org uuid;
  clean text := btrim(regexp_replace(coalesce(business_name, ''), '\s+', ' ', 'g'));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first';
  END IF;
  SELECT organization_id INTO org FROM organization_members WHERE user_id = auth.uid();
  IF org IS NOT NULL THEN
    RETURN org;
  END IF;
  IF length(clean) < 2 OR length(clean) > 120 THEN
    RAISE EXCEPTION 'Please enter your business name';
  END IF;

  INSERT INTO organizations (name) VALUES (clean) RETURNING id INTO org;
  INSERT INTO organization_members (organization_id, user_id, role) VALUES (org, auth.uid(), 'owner');
  INSERT INTO business_settings (
    organization_id, business_name, email, brand_color, accent_color, default_terms
  ) VALUES (
    org,
    clean,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    '#1f3a5f',
    '#dbe4ee',
    'Payment is due within 14 days of the invoice date. All prices are in Australian Dollars (AUD).'
  );
  RETURN org;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;

-- ============================================
-- PHOTOS AND LOGOS: EACH BUSINESS ONLY CHANGES ITS OWN FILES
-- ============================================
-- New uploads go in a folder named after the business id. Files uploaded before this change
-- have no business folder and belong to the original business.
CREATE OR REPLACE FUNCTION public.storage_path_in_my_org(object_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.current_org_id() IS NULL THEN false
    WHEN split_part(object_name, '/', 1) = public.current_org_id()::text THEN true
    WHEN EXISTS (SELECT 1 FROM organizations WHERE is_default AND id = public.current_org_id())
      AND NOT EXISTS (SELECT 1 FROM organizations WHERE id::text = split_part(object_name, '/', 1)) THEN true
    ELSE false
  END
$$;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '''(quotes|Products|Logos)'''
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Business files: read own" ON storage.objects;
DROP POLICY IF EXISTS "Business files: upload" ON storage.objects;
DROP POLICY IF EXISTS "Business files: replace" ON storage.objects;
DROP POLICY IF EXISTS "Business files: delete" ON storage.objects;
CREATE POLICY "Business files: read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('quotes', 'Products', 'Logos') AND public.storage_path_in_my_org(name));
CREATE POLICY "Business files: upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('quotes', 'Products', 'Logos') AND public.storage_path_in_my_org(name));
CREATE POLICY "Business files: replace" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('quotes', 'Products', 'Logos') AND public.storage_path_in_my_org(name))
  WITH CHECK (bucket_id IN ('quotes', 'Products', 'Logos') AND public.storage_path_in_my_org(name));
CREATE POLICY "Business files: delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('quotes', 'Products', 'Logos') AND public.storage_path_in_my_org(name));

COMMIT;

-- ============================================
-- CHECK: paste this result back to Claude
-- ============================================
-- Every business table should show one policy, "Members manage their own business". Any other
-- policy listed for storage.objects should be read-only (SELECT) or for a different bucket.
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN (
    'customers', 'products', 'quotes', 'invoices', 'quote_messages', 'appointments', 'purchase_orders',
    'expenses', 'templates', 'business_settings', 'website_enquiries', 'organizations', 'organization_members'))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY tablename, policyname;
