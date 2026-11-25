-- Let a business ask a customer for a Google review (only when someone presses the button).
-- Purely additive, so it's safe to run before or after the code that uses it is live.
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS google_review_url text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;

-- Ideal Events Hire's review link.
UPDATE business_settings
SET google_review_url = 'https://search.google.com/local/writereview?placeid=ChIJUyUgYBQ2YYgRy1R2SrNEtN0'
WHERE organization_id = (SELECT id FROM organizations WHERE is_default)
  AND google_review_url IS NULL;

-- CHECK: should show one row for Ideal Events Hire with the Google link.
SELECT business_name, google_review_url FROM business_settings WHERE google_review_url IS NOT NULL;
