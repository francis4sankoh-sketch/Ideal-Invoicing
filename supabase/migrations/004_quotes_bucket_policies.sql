-- Storage policies for the `quotes` bucket so signed-in admins can
-- upload, replace, and delete line-item photos. Public reads are allowed
-- because the bucket is marked public, but writes need explicit policies.

-- Public read (matches "public" bucket setting)
DROP POLICY IF EXISTS "Public read quotes bucket" ON storage.objects;
CREATE POLICY "Public read quotes bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quotes');

-- Authenticated upload
DROP POLICY IF EXISTS "Authenticated upload quotes bucket" ON storage.objects;
CREATE POLICY "Authenticated upload quotes bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quotes');

-- Authenticated update (for upsert / replace)
DROP POLICY IF EXISTS "Authenticated update quotes bucket" ON storage.objects;
CREATE POLICY "Authenticated update quotes bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'quotes')
  WITH CHECK (bucket_id = 'quotes');

-- Authenticated delete (so photo cleanup works from the browser)
DROP POLICY IF EXISTS "Authenticated delete quotes bucket" ON storage.objects;
CREATE POLICY "Authenticated delete quotes bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'quotes');
