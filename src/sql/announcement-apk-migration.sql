INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-apks', 'announcement-apks', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Admins can upload announcement APKs" ON storage.objects;
CREATE POLICY "Admins can upload announcement APKs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'announcement-apks'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Anyone can download announcement APKs" ON storage.objects;
CREATE POLICY "Anyone can download announcement APKs" ON storage.objects FOR SELECT TO public USING (
  bucket_id = 'announcement-apks'
);

DROP POLICY IF EXISTS "Admins can update announcement APKs" ON storage.objects;
CREATE POLICY "Admins can update announcement APKs" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'announcement-apks'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can delete announcement APKs" ON storage.objects;
CREATE POLICY "Admins can delete announcement APKs" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'announcement-apks'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS apk_url TEXT;
