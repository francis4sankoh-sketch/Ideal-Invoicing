-- Delivery status of the last invoice/reminder email sent for each invoice, kept up to date by
-- the Resend webhook (app/api/resend/webhook). Purely additive.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_status text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_status_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_status_detail text;
