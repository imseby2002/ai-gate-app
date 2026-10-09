-- =============================================
-- AI GATE - Migration 20261009 (channel accounts)
-- 公司層級的官方帳號（Zalo OA、LINE 官方帳號、WhatsApp Business…），每個平台可設多組。
-- modules 記錄哪些模組使用此帳號（cs / marketing / hr / affairs）。
-- 只經由 /api/company/channels（service role）存取，權限在程式層把關；不開放 RLS policy。
-- =============================================

create table if not exists public.channel_accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  platform      text not null,
  name          text not null,
  credentials   jsonb not null default '{}',
  modules       text[] not null default '{}',
  is_connected  boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists channel_accounts_company_idx on public.channel_accounts (company_id, platform);

alter table public.channel_accounts enable row level security;
