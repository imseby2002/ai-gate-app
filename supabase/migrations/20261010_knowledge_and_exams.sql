-- =============================================
-- AI GATE - Migration 20261010 (company knowledge base & exams)
-- knowledge_docs：公司知識檔案（各部門上傳，全公司共用），供考試出題、專家、短影音自動化、AI 對話使用
-- exams / exam_questions：考卷與題目（AI 依知識出題、人工審核），題目、選項、說明皆為中英越三語
-- exam_submissions：作答紀錄（員工登入作答，或應徵者經公開連結作答）
-- 一律只經由 API（service role）存取，權限在程式層把關；不開放 RLS policy。
-- =============================================

create table if not exists public.knowledge_docs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  department   text not null,                 -- 部門鍵（hr / marketing …）或 system（全公司）
  title        text not null,
  source_type  text not null default 'file',  -- file / text
  file_name    text,
  content      text not null default '',
  char_count   int not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists knowledge_docs_company_idx on public.knowledge_docs (company_id, department, created_at desc);
alter table public.knowledge_docs enable row level security;

create table if not exists public.exams (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  department         text not null,
  title              jsonb not null default '{}',   -- { zh, en, vi }
  description        jsonb not null default '{}',
  status             text not null default 'draft', -- draft / published / closed
  audience           text[] not null default '{employee}', -- employee / public
  public_token       text unique,
  knowledge_doc_ids  uuid[] not null default '{}',
  pass_score         int,                            -- 及格分（百分比，可空）
  reveal_answers     boolean not null default true,  -- 交卷後是否顯示正確答案與說明
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists exams_company_idx on public.exams (company_id, department, created_at desc);
alter table public.exams enable row level security;

create table if not exists public.exam_questions (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams(id) on delete cascade,
  position     int not null default 0,
  type         text not null,            -- single / multi / fill / short / essay
  question     jsonb not null default '{}',
  options      jsonb not null default '[]',  -- [{ key: 'A', text: { zh, en, vi } }]
  answer       jsonb not null default '{}',  -- single: "A"；multi: ["A","C"]；fill: { zh: [..], en: [..], vi: [..] }；short/essay: 參考答案 { zh, en, vi }
  rubric       jsonb not null default '{}',  -- short/essay 評分重點 { zh, en, vi }
  explanation  jsonb not null default '{}',
  points       int not null default 1,
  created_at   timestamptz not null default now()
);
create index if not exists exam_questions_exam_idx on public.exam_questions (exam_id, position);
alter table public.exam_questions enable row level security;

create table if not exists public.exam_submissions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  kind            text not null,            -- employee / public
  user_id         uuid references public.profiles(id) on delete set null,
  taker_name      text not null,
  taker_contact   text,
  lang            text,
  answers         jsonb not null default '{}',
  results         jsonb not null default '{}', -- { [questionId]: { score, max, correct?, feedback? } }
  score           numeric not null default 0,
  max_score       numeric not null default 0,
  grading_status  text not null default 'graded', -- graded / pending（簡答、申論待評分）/ reviewed（人工覆核過）
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index if not exists exam_submissions_exam_idx on public.exam_submissions (exam_id, created_at desc);
create index if not exists exam_submissions_user_idx on public.exam_submissions (user_id, created_at desc);
alter table public.exam_submissions enable row level security;
