-- Migration: 20240101000005_storage
-- Creates the product-images storage bucket.
-- Access: public read; authenticated write only to own listings/{user_id}/ prefix.
-- db-guard reviewed: 2026-07-12

-- ─── Bucket ───────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS on storage.objects ───────────────────────────────────────────────────
-- storage.objects RLS must be enabled (Supabase enables it by default)

-- Public read: anyone can view images in this bucket
CREATE POLICY "product-images public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Authenticated insert: user may only write to listings/{their user_id}/ prefix
CREATE POLICY "product-images auth insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND name LIKE 'listings/' || auth.uid()::text || '/%'
  );

-- Authenticated update: user may only update their own files
CREATE POLICY "product-images auth update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND name LIKE 'listings/' || auth.uid()::text || '/%'
  );

-- Authenticated delete: user may only delete their own files
CREATE POLICY "product-images auth delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND name LIKE 'listings/' || auth.uid()::text || '/%'
  );
