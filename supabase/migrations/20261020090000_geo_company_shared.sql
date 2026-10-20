-- GEO 專案同公司成員共享（可看可編；刪除由 API 限建立者）
create or replace function public.geo_can_access(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = auth.uid() or exists (
    select 1 from company_members a join company_members b on a.company_id = b.company_id
    where a.member_id = auth.uid() and b.member_id = p_owner and a.status = 'active' and b.status = 'active'
  )
$$;

create policy "company geo_projects" on public.geo_projects for all
  using (public.geo_can_access(user_id)) with check (public.geo_can_access(user_id));
create policy "company geo_questions" on public.geo_questions for all
  using (exists (select 1 from geo_projects p where p.id = project_id and public.geo_can_access(p.user_id)))
  with check (exists (select 1 from geo_projects p where p.id = project_id and public.geo_can_access(p.user_id)));
create policy "company geo_clusters" on public.geo_clusters for all
  using (exists (select 1 from geo_projects p where p.id = project_id and public.geo_can_access(p.user_id)))
  with check (exists (select 1 from geo_projects p where p.id = project_id and public.geo_can_access(p.user_id)));
create policy "company geo_articles" on public.geo_articles for all
  using (exists (select 1 from geo_projects p where p.id = project_id and public.geo_can_access(p.user_id)))
  with check (exists (select 1 from geo_projects p where p.id = project_id and public.geo_can_access(p.user_id)));
create policy "company geo_tracking" on public.geo_tracking for all
  using (exists (select 1 from geo_questions q join geo_projects p on p.id = q.project_id where q.id = question_id and public.geo_can_access(p.user_id)))
  with check (exists (select 1 from geo_questions q join geo_projects p on p.id = q.project_id where q.id = question_id and public.geo_can_access(p.user_id)));
