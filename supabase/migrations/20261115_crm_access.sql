-- 客戶系統權限：公司負責人／公司管理員可把客戶系統開給公司其他成員。
-- role：view = 只能查看；edit = 可編輯、綁定帳號、合併、同步。
-- 公司負責人、公司管理員（company_members.role = owner/admin）與總管理員不需設定，預設可管理。
create table if not exists public.crm_access (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,   -- 公司 owner 帳號（客戶資料範圍）
  member_id uuid not null references public.profiles(id) on delete cascade,  -- 被授權的帳號
  role text not null check (role in ('view', 'edit')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, member_id)
);
-- 只透過 API（service role）存取
alter table public.crm_access enable row level security;
