-- =============================================
-- AI GATE - Migration 106
-- 應徵文件繳交勾選（紙本正本/影印本收到）＋整體繳交完成標記。
-- 應徵者上傳掃描檔（hr_candidate_documents）；人事在辦公室收到紙本後勾選。
-- =============================================

create table if not exists public.hr_candidate_checklist (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references public.agent_hr_candidates(id) on delete cascade,
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  doc_key           text not null,                       -- 對應 DOC_CATALOG.type
  original_received boolean not null default false,      -- 正本已繳
  copy_received     boolean not null default false,      -- 影印本已繳
  note              text not null default '',
  updated_at        timestamptz not null default now(),
  unique (candidate_id, doc_key)
);

create index if not exists idx_hr_candidate_checklist_cand
  on public.hr_candidate_checklist(candidate_id);

alter table public.hr_candidate_checklist enable row level security;

drop policy if exists "hr_candidate_checklist_owner" on public.hr_candidate_checklist;
create policy "hr_candidate_checklist_owner" on public.hr_candidate_checklist
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "hr_candidate_checklist_admin" on public.hr_candidate_checklist;
create policy "hr_candidate_checklist_admin" on public.hr_candidate_checklist
  for all using (public.is_admin());

-- 整體「繳交到辦公完成」標記（人事勾選）
alter table public.agent_hr_candidates
  add column if not exists docs_submitted_complete boolean not null default false;
