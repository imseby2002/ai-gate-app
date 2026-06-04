-- =============================================
-- AI GATE - Migration 037
-- 允許 marketing-assets bucket 存放 .pptx（簡報生成 skill）
-- =============================================
UPDATE storage.buckets
SET allowed_mime_types = array_append(
  allowed_mime_types,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
)
WHERE id = 'marketing-assets'
  AND NOT (
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    = ANY(allowed_mime_types)
  );
