-- Company 實體：多名員工共用一間公司的身分、知識庫、點數與模組開通權限。
-- 一人一公司（不做多公司切換），比照 is_admin() 的純量寫法而非 bnb_members 的
-- 多重歸屬 SETOF 寫法（bnb 是「一人可協作多個擁有者」，公司不是）。

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  -- 與既有訂房/客服「擁有者＋協作者」機制（bnb_members）相容用的錨點：
  -- 公司邀請員工時，若這裡有值，會同步在 bnb_members 建立對應列，讓既有
  -- 訂房/客服協作機制不用重寫也能跟著公司走。多數沒有用訂房模組的公司
  -- 會保持 null，同步邏輯直接跳過。
  bnb_owner_id uuid references public.profiles(id),
  -- null = 沿用 module-access.ts 現有的預設模組陣列邏輯，跟 profiles.enabled_modules 同一套慣例
  enabled_modules text[],
  compiled_knowledge_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.update_updated_at();

alter table public.companies enable row level security;

-- 員工名冊／邀請。role='owner' 是真的會被儲存的值（跟 bnb_members.role 的
-- CHECK 限制 admin|manager|viewer 不一樣——bnb_members 從不存擁有者列，靠
-- 資料本身的 user_id 隱含擁有權；company_members 沒有這種隱含錨點，需要
-- 顯式的 owner 角色）。
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete cascade, -- 邀請未接受前為 null，比照 bnb_members
  invited_email text not null,
  role text not null check (role in ('owner','admin','manager','viewer')),
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  token text,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index company_members_owner_email_uniq on public.company_members(company_id, invited_email);
-- 強制「一人一公司」：同一時間只能有一筆 active 列
create unique index company_members_one_active_company_per_member
  on public.company_members(member_id) where status = 'active';

alter table public.company_members enable row level security;

-- 員工歸屬公司的快速指標（denormalized，由下一支 migration 的 trigger 維護，不靠應用層手動同步）
alter table public.profiles add column company_id uuid references public.companies(id);
create index profiles_company_id_idx on public.profiles(company_id);
