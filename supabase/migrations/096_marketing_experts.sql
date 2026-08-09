-- 自製專家：使用者餵網址／文件／文字，訓練成某領域的專屬顧問。
-- 採 context-stuffing 架構（本專案無 pgvector，非向量檢索）：
-- 問答時把來源萃取文字塞進 system prompt，讓 LLM 依此作答。
create table if not exists public.marketing_experts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  system_prompt text not null default '',
  status        text not null default 'active',   -- active | archived
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.marketing_experts enable row level security;

drop policy if exists "own marketing_experts" on public.marketing_experts;
create policy "own marketing_experts" on public.marketing_experts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists marketing_experts_user_idx
  on public.marketing_experts (user_id, created_at desc);

-- 專家的知識來源：網址／檔案／純文字，萃取後的文字存 extracted_text。
create table if not exists public.marketing_expert_sources (
  id             uuid primary key default gen_random_uuid(),
  expert_id      uuid not null references public.marketing_experts(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  type           text not null,                  -- url | file | text
  name           text not null,
  source_url     text,                           -- url 或 storage 檔案 URL
  extracted_text text not null default '',
  char_count     int not null default 0,
  created_at     timestamptz not null default now()
);

alter table public.marketing_expert_sources enable row level security;

drop policy if exists "own marketing_expert_sources" on public.marketing_expert_sources;
create policy "own marketing_expert_sources" on public.marketing_expert_sources
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists marketing_expert_sources_expert_idx
  on public.marketing_expert_sources (expert_id, created_at asc);
