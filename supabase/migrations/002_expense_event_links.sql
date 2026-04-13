-- Add quote_id and invoice_id to expenses so they can be linked to events
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_expenses_quote_id ON expenses(quote_id);
CREATE INDEX IF NOT EXISTS idx_expenses_invoice_id ON expenses(invoice_id);
