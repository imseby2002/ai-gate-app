-- =============================================
-- AI GATE - Migration 20261007 (meetings delete)
-- 主持人可刪除會議（逐字稿、參與者隨 FK cascade 一併刪除）；
-- 其他參與者可把會議從自己的紀錄移除（刪除自己的參與者列）。
-- =============================================

create policy "meetings host delete" on public.meetings
  for delete using (host_id = auth.uid());

create policy "meeting_participants self delete" on public.meeting_participants
  for delete using (user_id = auth.uid());
