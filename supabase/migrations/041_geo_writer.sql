-- GEO Writer：內容產生與追蹤資料表（對應 docs/geo-writer-design.md）
-- 步驟2 起用 geo_projects / geo_questions / geo_articles；clusters / tracking 為後續步驟預留。
-- RLS：父表依 user_id；子表依所屬 project 的 user_id。

-- ── 專案 ─────────────────────────────────────────────
create table if not exists public.geo_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  seed_topic text not null,
  locale text not null default 'zh-TW',
  exclusive_facts text,
  author text,
  created_at timestamptz not null default now()
);

alter table public.geo_projects enable row level security;
drop policy if exists "own geo_projects" on public.geo_projects;
create policy "own geo_projects" on public.geo_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists geo_projects_user_recent_idx
  on public.geo_projects (user_id, created_at desc);

-- ── 聚叢（步驟4 用，先建表）─────────────────────────────
create table if not exists public.geo_clusters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.geo_projects(id) on delete cascade,
  title text not null,
  pillar boolean not null default false,
  question_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.geo_clusters enable row level security;
drop policy if exists "own geo_clusters" on public.geo_clusters;
create policy "own geo_clusters" on public.geo_clusters
  for all using (
    exists (select 1 from public.geo_projects p where p.id = project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.geo_projects p where p.id = project_id and p.user_id = auth.uid())
  );

create index if not exists geo_clusters_project_idx on public.geo_clusters (project_id);

-- ── 問句 ─────────────────────────────────────────────
create table if not exists public.geo_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.geo_projects(id) on delete cascade,
  question text not null,
  intent text,                                  -- info | local | compare | transact
  volume int,
  volume_source text,                           -- measured | estimated | unknown
  competition_score numeric,
  intent_score numeric,
  opportunity_score numeric,
  cluster_id uuid references public.geo_clusters(id) on delete set null,
  status text not null default 'suggested',     -- suggested | selected | written
  created_at timestamptz not null default now()
);

alter table public.geo_questions enable row level security;
drop policy if exists "own geo_questions" on public.geo_questions;
create policy "own geo_questions" on public.geo_questions
  for all using (
    exists (select 1 from public.geo_projects p where p.id = project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.geo_projects p where p.id = project_id and p.user_id = auth.uid())
  );

create index if not exists geo_questions_project_idx on public.geo_questions (project_id);

-- ── 文章 ─────────────────────────────────────────────
-- 設計文件中 geo_articles 掛 cluster；步驟2 尚未聚叢，故同時保留 project_id 直接關聯，cluster_id 可為空。
create table if not exists public.geo_articles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.geo_projects(id) on delete cascade,
  cluster_id uuid references public.geo_clusters(id) on delete set null,
  title text not null,
  body_md text not null,
  json_ld jsonb,
  question_ids uuid[] not null default '{}',
  exclusive_used boolean not null default false,
  dedup_hash text,
  published_url text,
  status text not null default 'draft',          -- draft | published
  created_at timestamptz not null default now()
);

alter table public.geo_articles enable row level security;
drop policy if exists "own geo_articles" on public.geo_articles;
create policy "own geo_articles" on public.geo_articles
  for all using (
    exists (select 1 from public.geo_projects p where p.id = project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.geo_projects p where p.id = project_id and p.user_id = auth.uid())
  );

create index if not exists geo_articles_project_idx on public.geo_articles (project_id);

-- ── 追蹤（步驟5 用，先建表）─────────────────────────────
create table if not exists public.geo_tracking (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.geo_questions(id) on delete cascade,
  engine text not null,                          -- perplexity | chatgpt | ...
  checked_at timestamptz not null default now(),
  cited boolean not null default false,
  rank int,
  cited_sources text[] not null default '{}'
);

alter table public.geo_tracking enable row level security;
drop policy if exists "own geo_tracking" on public.geo_tracking;
create policy "own geo_tracking" on public.geo_tracking
  for all using (
    exists (
      select 1 from public.geo_questions q
      join public.geo_projects p on p.id = q.project_id
      where q.id = question_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.geo_questions q
      join public.geo_projects p on p.id = q.project_id
      where q.id = question_id and p.user_id = auth.uid()
    )
  );

create index if not exists geo_tracking_question_idx on public.geo_tracking (question_id, checked_at desc);
