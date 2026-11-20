-- Customer accepts an invoice's terms and conditions from the portal.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_accepted_by text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms_accepted_ip text;
