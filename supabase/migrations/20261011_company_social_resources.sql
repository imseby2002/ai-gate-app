-- 公司帳號社群矩陣資源（後台控制）：官方 IP 附贈數（ISP／住宅）、AdsPower 自備或共享代管、環境數與成員席次。
-- 企業版為方案內附贈不扣點；一般公司版依公式從公司錢包扣款（成員每席 3／月＋環境費累進）。
create table if not exists public.marketing_company_social_resources (
  company_id uuid primary key references public.companies(id) on delete cascade,
  isp_gift integer not null default 0,
  residential_gift integer not null default 0,
  adspower_mode text not null default 'own' check (adspower_mode in ('own', 'managed')),
  env_quota integer not null default 200 check (env_quota > 0),
  member_seats integer not null default 1 check (member_seats > 0),
  group_name text,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'suspended')),
  billing_cycle text not null default 'annual' check (billing_cycle in ('monthly', 'annual')),
  price_credits numeric,
  paid_until timestamptz,
  auto_renew boolean not null default true,
  admin_note text,
  updated_at timestamptz not null default now()
);

-- 代管成員席次：每席一個 AdsPower 成員帳號，可指派給公司內一位成員
create table if not exists public.marketing_company_adspower_seats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null,
  login_account text not null,
  login_password_enc text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_company_adspower_seats_company_idx on public.marketing_company_adspower_seats(company_id);
create unique index if not exists marketing_company_adspower_seats_member_idx on public.marketing_company_adspower_seats(member_id) where member_id is not null;

-- 僅經伺服器端（service role）存取
alter table public.marketing_company_social_resources enable row level security;
alter table public.marketing_company_adspower_seats enable row level security;
