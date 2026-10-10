-- =============================================
-- AI GATE - Migration 20261010 (channel module bindings)
-- 各模組在每個平台選用公司哪一組官方帳號（例如外務的 Zalo 通知用「員工通知 OA」）。
-- 未設定時發送端依 modules 欄位自動挑選。只經 API（service role）存取。
-- =============================================

create table if not exists public.channel_module_bindings (
  company_id  uuid not null references public.companies(id) on delete cascade,
  module      text not null,
  platform    text not null,
  account_id  uuid not null references public.channel_accounts(id) on delete cascade,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (company_id, module, platform)
);

alter table public.channel_module_bindings enable row level security;
