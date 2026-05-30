-- Support automated reminder nudges for sent-but-not-accepted quotes.
-- sent_at        : when the quote was last emailed to the customer
-- reminder_count : how many nudges we've sent so far
-- last_reminder_sent already exists on invoices but NOT quotes — add it here.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS last_reminder_sent date;
