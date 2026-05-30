-- Track how many of each item the business owns, so quotes/invoices can
-- warn about double-booking on overlapping event dates.
-- Nullable: a null value means "not tracked" (no quantity warning, only a
-- soft "already booked that day" note).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quantity_owned integer;
