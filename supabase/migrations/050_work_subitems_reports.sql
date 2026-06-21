-- 子項目：work_docs 自我參照
alter table public.work_docs add column if not exists parent_id uuid references public.work_docs(id) on delete cascade;
create index if not exists work_docs_parent_idx on public.work_docs (parent_id);

-- 報告：擴充 work_comments 支援 文字/連結/檔案
alter table public.work_comments add column if not exists kind text not null default 'text'; -- text | link | file
alter table public.work_comments add column if not exists url text;
alter table public.work_comments add column if not exists file_name text;

-- 報告附件儲存桶（公開讀）
insert into storage.buckets (id, name, public)
values ('work-reports', 'work-reports', true)
on conflict (id) do nothing;

drop policy if exists "work-reports read" on storage.objects;
create policy "work-reports read" on storage.objects
  for select using (bucket_id = 'work-reports');

drop policy if exists "work-reports insert" on storage.objects;
create policy "work-reports insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'work-reports');

-- 子項目存取：父項目的擁有者或成員皆可
create or replace function public.work_parent_owned(p_parent uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.work_docs where id = p_parent and user_id = auth.uid());
$$;

drop policy if exists "work_docs access" on public.work_docs;
create policy "work_docs access" on public.work_docs
  for all using (
    auth.uid() = user_id
    or public.is_work_item_member(id)
    or (parent_id is not null and (public.is_work_item_member(parent_id) or public.work_parent_owned(parent_id)))
  )
  with check (
    auth.uid() = user_id
    or public.is_work_item_member(id)
    or (parent_id is not null and (public.is_work_item_member(parent_id) or public.work_parent_owned(parent_id)))
  );
