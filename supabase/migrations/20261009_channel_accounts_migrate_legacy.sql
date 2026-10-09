-- =============================================
-- AI GATE - Migration 20261009 (channel accounts: migrate legacy CS channels)
-- 把公司負責人在客服頻道設定（social_platform_credentials）填的訊息平台憑證，
-- 複製一份到公司「官方帳號」（channel_accounts）。舊資料保留不刪（未建公司的個人帳號仍讀舊設定）。
-- legacy_source 記錄來源列，重跑不會重複建立。
--   line → 客服；telegram、zalo → 客服＋人事＋外務（這兩個平台原本也用來發員工通知）；
--   whatsapp / messenger / instagram → 客服
-- =============================================

alter table public.channel_accounts add column if not exists legacy_source text;
create unique index if not exists channel_accounts_legacy_source_key on public.channel_accounts (legacy_source);

insert into public.channel_accounts (company_id, platform, name, credentials, modules, is_connected, created_by, legacy_source)
select
  cm.company_id,
  m.platform,
  m.name,
  s.credentials,
  m.modules,
  coalesce(s.is_connected, false),
  s.user_id,
  'social:' || s.user_id || ':' || s.platform
from public.social_platform_credentials s
join public.company_members cm
  on cm.member_id = s.user_id and cm.role = 'owner' and cm.status = 'active'
join (values
  ('line',      'line_oa',           'LINE OA',            array['cs']),
  ('telegram',  'telegram',          'Telegram Bot',       array['cs','hr','affairs']),
  ('zalo',      'zalo_oa',           'Zalo OA',            array['cs','hr','affairs']),
  ('whatsapp',  'whatsapp_business', 'WhatsApp Business',  array['cs']),
  ('messenger', 'messenger',         'Facebook Messenger', array['cs']),
  ('instagram', 'instagram',         'Instagram',          array['cs'])
) as m(legacy, platform, name, modules) on m.legacy = s.platform
where jsonb_typeof(s.credentials) = 'object' and s.credentials <> '{}'::jsonb
on conflict (legacy_source) do nothing;
