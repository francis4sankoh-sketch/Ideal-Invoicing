-- Close the anonymous access the customer portal used to rely on.
--
-- 001_initial_schema.sql let anyone holding the public (anon) key read every
-- customer, quote, invoice, portal message and the business settings, and
-- update any quote. The portal now goes through /api/portal, which checks the
-- customer's portal token on the server, so none of these are needed.
--
-- Run this ONLY after the code that moved the portal to /api/portal is live,
-- otherwise the portal stops loading until it is.
--
-- Logged-in dashboard access ("Authenticated users full access") is untouched.
-- "Public read products" and "Public insert enquiries" stay as they are.

DROP POLICY IF EXISTS "Portal access via token" ON customers;
DROP POLICY IF EXISTS "Portal access quotes" ON quotes;
DROP POLICY IF EXISTS "Portal update quotes" ON quotes;
DROP POLICY IF EXISTS "Portal access invoices" ON invoices;
DROP POLICY IF EXISTS "Portal read messages" ON quote_messages;
DROP POLICY IF EXISTS "Portal send messages" ON quote_messages;
DROP POLICY IF EXISTS "Portal read settings" ON business_settings;
