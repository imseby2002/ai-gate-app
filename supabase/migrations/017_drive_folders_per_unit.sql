-- Per-unit Google Drive folder mapping on campaigns
-- drive_folders: { "5": { "id": "...", "name": "..." }, "6": { ... }, "7": { ... } }
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS drive_folders JSONB NOT NULL DEFAULT '{}';
