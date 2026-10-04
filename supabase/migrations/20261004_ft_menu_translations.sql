-- 點單機菜單翻譯：iPOS 只有越南文，以原文字串為 key 存中文、英文
-- 由 AI 自動補齊（manual=false）；人工修正後設 manual=true，自動翻譯不會覆蓋
create table if not exists public.ft_menu_translations (
  source text primary key,
  zh_tw text,
  en text,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 只透過 service role（伺服器端）存取
alter table public.ft_menu_translations enable row level security;
