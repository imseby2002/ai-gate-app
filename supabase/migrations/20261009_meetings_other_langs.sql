-- =============================================
-- AI GATE - Migration 20261009 (meetings other_langs)
-- 會議語言：source_lang = 主要語言，other_langs = 其他會出現的語言
-- null = 舊會議（沿用中/越/英自動偵測）
-- =============================================

alter table public.meetings add column if not exists other_langs text[];
