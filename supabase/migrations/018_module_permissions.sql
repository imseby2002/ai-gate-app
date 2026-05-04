-- Add enabled_modules to profiles
-- Default: all modules enabled
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enabled_modules text[]
    NOT NULL DEFAULT ARRAY['chat','marketing','cs','leads','resume']::text[];
