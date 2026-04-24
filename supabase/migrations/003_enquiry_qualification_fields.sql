-- Add qualification fields to website_enquiries so we can pre-screen leads
-- at a glance (guest count range, budget band, venue access notes).
--
-- The existing guest_count column was an integer, but the website contact
-- form now sends a string range like "30-60". Converting the column to text
-- in place (with a USING cast) keeps the column name and any existing rows;
-- old numeric values become their string equivalents (e.g. 50 -> "50").

ALTER TABLE website_enquiries
  ALTER COLUMN guest_count TYPE text
  USING guest_count::text;

ALTER TABLE website_enquiries
  ADD COLUMN IF NOT EXISTS budget_range text;

ALTER TABLE website_enquiries
  ADD COLUMN IF NOT EXISTS venue_access text;
