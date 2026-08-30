-- Roundtable（圓桌研議）目前完全沒有存檔：整個討論只存在瀏覽器當下畫面的
-- React state，一離開頁面就消失，後端 API 只負責把串流結果轉發給畫面，
-- 從頭到尾沒有寫進資料庫。新增這張表儲存每一次完整研議的逐輪發言與最終報告，
-- 單純比照 assistants／marketing_campaigns／company_data 的單一擁有者模式
-- （不需要 bnb_members 那種協作機制）。
create table public.roundtable_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  instruction text not null,
  seats jsonb not null default '[]',      -- 這次用的席位設定（name/model/role），供列表與詳情顯示
  rebuttal boolean not null default true, -- 是否有跑第二輪互評
  transcript jsonb not null default '[]', -- [{round, name, role, content}], 逐輪逐位發言
  report text,                            -- 第三輪整合者的最終報告；跑到一半失敗可能為 null
  created_at timestamptz not null default now()
);

create index roundtable_sessions_user_created_idx
  on public.roundtable_sessions (user_id, created_at desc);

alter table public.roundtable_sessions enable row level security;

create policy "roundtable_sessions_own" on public.roundtable_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "roundtable_sessions_admin" on public.roundtable_sessions
  for all using (public.is_admin());
