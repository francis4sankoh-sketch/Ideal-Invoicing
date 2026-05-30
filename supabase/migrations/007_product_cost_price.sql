-- Optional per-unit cost for each product, so the item profitability report
-- can show margin (revenue minus cost) instead of turnover alone.
-- Nullable: when not set, the report shows turnover only for that item.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price numeric;
