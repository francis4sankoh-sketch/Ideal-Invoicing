-- Support creating and sending invoices directly, without going through a
-- quote first. Quotes remain fully usable for anything already in flight —
-- this only adds what invoices need to gain feature parity as the primary
-- document: a discount type/value pair, a GST toggle, and terms, matching
-- what quotes already have. A 'draft' status also becomes valid app-side
-- (invoices.status has no CHECK constraint, so no schema change needed for
-- that — see 001_initial_schema.sql).

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS include_gst boolean DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms text;

-- Website enquiries now auto-create a draft invoice instead of a draft
-- quote. Keep the existing quote_id column (and any historical data in it)
-- untouched — this is purely additive.
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
