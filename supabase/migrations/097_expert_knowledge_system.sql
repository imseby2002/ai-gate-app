-- 專家知識系統：使用者貼上 YouTube / Blog URL（或搜尋、手動輸入），
-- AI 合成成結構化知識，之後可注入 Assistant 對話與 Roundtable 各席位的 system prompt。
--
-- experts：知識來源的「人」（可以是系統內建，也可以是使用者自建）
-- expert_knowledge：每個 expert 對應一筆合成後的知識內容（1:1，用獨立表方便未來擴充版本/多來源）

create table if not exists public.experts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  domain       text,
  source_url   text,
  source_type  text not null default 'other'
               check (source_type in ('youtube', 'tiktok', 'instagram', 'blog', 'search', 'manual', 'other')),
  description  text,
  avatar_url   text,
  is_system    boolean not null default false,
  created_by   uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists public.expert_knowledge (
  id            uuid primary key default gen_random_uuid(),
  expert_id     uuid not null references public.experts(id) on delete cascade,
  raw_content   text,
  structured    text,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'ready', 'failed')),
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_expert_knowledge_expert_id on public.expert_knowledge (expert_id);
create index if not exists idx_experts_created_by on public.experts (created_by);

create trigger experts_knowledge_updated_at before update on public.expert_knowledge
  for each row execute function public.update_updated_at();

-- Assistant 可綁定多個專家（沿用 assistants 表既有的 owner-only RLS，這裡只加欄位）
alter table public.assistants
  add column if not exists expert_ids uuid[] not null default '{}';

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.experts enable row level security;
alter table public.expert_knowledge enable row level security;

-- 系統專家所有登入用戶可讀；自建專家僅本人可讀
create policy "experts_select_system_or_own" on public.experts
  for select using (is_system = true or created_by = auth.uid());

-- 一般使用者只能新增/修改/刪除「自己建立、非系統」的專家
create policy "experts_manage_own" on public.experts
  for all using (created_by = auth.uid() and is_system = false)
  with check (created_by = auth.uid() and is_system = false);

create policy "experts_admin" on public.experts
  for all using (public.is_admin());

-- expert_knowledge 的可見範圍跟著對應的 expert 走
create policy "expert_knowledge_select" on public.expert_knowledge
  for select using (
    exists (
      select 1 from public.experts e
      where e.id = expert_knowledge.expert_id
        and (e.is_system = true or e.created_by = auth.uid())
    )
  );

create policy "expert_knowledge_admin" on public.expert_knowledge
  for all using (public.is_admin());

-- 一般寫入（建立/更新合成結果）一律透過 service-role client（pipeline 背景處理），
-- 不另外開放 authenticated 角色的 insert/update policy。
