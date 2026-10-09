-- =============================================
-- AI GATE - Migration 20261007 (meetings host select)
-- 建立會議失敗：insert ... returning 需通過 SELECT policy，
-- 但 is_meeting_participant() 在同一語句內看不到剛插入的列 → 42501。
-- 另加一條主持人可讀的 SELECT policy（與既有 policy 為 OR）。
-- =============================================

create policy "meetings host select" on public.meetings
  for select using (host_id = auth.uid());
