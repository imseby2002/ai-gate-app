-- =============================================
-- AI GATE - Migration 013
-- Marketing Assets Storage Bucket
-- =============================================

-- Create storage bucket for marketing assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-assets',
  'marketing-assets',
  true,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'text/plain',
    'text/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

-- RLS: Users can only manage their own files
CREATE POLICY "Users upload own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'marketing-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'marketing-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for sharing links
CREATE POLICY "Public read marketing assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-assets');
