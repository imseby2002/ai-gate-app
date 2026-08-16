-- =============================================
-- AI GATE - Migration 104
-- 應徵流程（階段 5b）：公開應徵表單 + 文件上傳 + 應徵者自行編輯
-- - hr_settings.apply_code：每家公司的公開應徵代碼（決定應徵歸屬 owner）
-- - agent_hr_candidates.apply_token：每位應徵者的私密編輯 token（僅應徵者與後台可改）
-- - hr_candidate_documents：應徵文件清單（履歷/身分證/健康證明…）
-- - 私有 storage bucket：hr-candidate-docs
-- 公開存取一律走 service-role 路由並以 code/token 驗證，不開放匿名 RLS。
-- =============================================

alter table public.hr_settings
  add column if not exists apply_code text unique;               -- 公開應徵代碼

alter table public.agent_hr_candidates
  add column if not exists apply_token text unique;              -- 應徵者私密編輯 token

create table if not exists public.hr_candidate_documents (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.agent_hr_candidates(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  doc_type      text not null default '',   -- resume/id_card/application/cv/diploma/health/birth/other
  label         text not null default '',
  file_name     text not null default '',
  storage_path  text not null default '',   -- hr-candidate-docs 內路徑
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_hr_candidate_documents_cand
  on public.hr_candidate_documents(candidate_id, uploaded_at desc);

alter table public.hr_candidate_documents enable row level security;

drop policy if exists "hr_candidate_documents_owner" on public.hr_candidate_documents;
create policy "hr_candidate_documents_owner" on public.hr_candidate_documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "hr_candidate_documents_admin" on public.hr_candidate_documents;
create policy "hr_candidate_documents_admin" on public.hr_candidate_documents
  for all using (public.is_admin());

-- 私有 bucket：應徵文件（含個資，不公開）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-candidate-docs', 'hr-candidate-docs', false, 10485760, -- 10MB
  array[
    'image/jpeg','image/png','image/webp','image/heic','application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
) on conflict (id) do nothing;
