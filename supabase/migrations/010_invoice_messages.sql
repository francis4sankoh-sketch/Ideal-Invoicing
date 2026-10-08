-- Let customers message on invoices in the portal, not just quotes.
-- quote_messages keeps its name; a message now belongs to either a quote
-- (quote_id) or an invoice (invoice_id). quote_id was already nullable.
-- Purely additive, so it's safe to run before the code that uses it is live.

ALTER TABLE quote_messages ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quote_messages_invoice_id ON quote_messages(invoice_id);
