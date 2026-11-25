-- Run this BEFORE deploying the matching code (creating invoices and quotes needs the function below).
-- The code that's live today keeps working after this runs. Safe to run twice.
BEGIN;

-- ============================================
-- INVOICE AND QUOTE NUMBERS
-- ============================================
-- Hands out the next number in one step. The settings row is locked while it runs, so two people
-- (or a website enquiry) can never get the same number, and numbers already in use are skipped.
CREATE OR REPLACE FUNCTION public.take_number_for_org(p_org uuid, p_kind text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s business_settings%ROWTYPE;
  n integer;
  candidate text;
BEGIN
  IF p_kind NOT IN ('invoice', 'quote') THEN
    RAISE EXCEPTION 'Unknown number type';
  END IF;
  SELECT * INTO s FROM business_settings WHERE organization_id = p_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Finish setting up your business first';
  END IF;

  IF p_kind = 'invoice' THEN
    n := coalesce(s.next_invoice_number, 1001);
    LOOP
      candidate := coalesce(s.invoice_prefix, 'INV') || '-' || n;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM invoices WHERE organization_id = p_org AND invoice_number = candidate);
      n := n + 1;
    END LOOP;
    UPDATE business_settings SET next_invoice_number = n + 1 WHERE id = s.id;
  ELSE
    n := coalesce(s.next_quote_number, 1001);
    LOOP
      candidate := coalesce(s.quote_prefix, 'Q') || '-' || n;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM quotes WHERE organization_id = p_org AND quote_number = candidate);
      n := n + 1;
    END LOOP;
    UPDATE business_settings SET next_quote_number = n + 1 WHERE id = s.id;
  END IF;
  RETURN candidate;
END $$;

-- What the app calls for the signed-in login's own business.
CREATE OR REPLACE FUNCTION public.take_number(p_kind text) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.take_number_for_org(public.current_org_id(), p_kind)
$$;

-- Choosing the business is for the server only.
REVOKE EXECUTE ON FUNCTION public.take_number_for_org(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_number_for_org(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.take_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_number(text) TO authenticated;

-- ============================================
-- FORGOT PASSWORD: LIMIT HOW OFTEN IT CAN BE ASKED FOR
-- ============================================
-- Holds scrambled (hashed) emails and IPs for a day. Server only: no policies, so no login can read it.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created_at ON password_reset_requests (created_at);
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DASHBOARD LIST: "DON'T ASK" FOR A REVIEW
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS review_skipped_at timestamptz;

-- ============================================
-- OLD "COMPLETED" INVOICES: ALL FULLY PAID, SO MARK THEM PAID
-- ============================================
UPDATE invoices SET status = 'paid' WHERE status = 'completed' AND balance_due <= 0;

COMMIT;

-- CHECK: "completed_left" should be 0.
SELECT (SELECT count(*) FROM invoices WHERE status = 'completed') AS completed_left,
       (SELECT next_invoice_number FROM business_settings ORDER BY created_at LIMIT 1) AS next_invoice_number;
