-- 升級 Roundtable 2.0: 支援領域、會前事實簡報與互動狀態
alter table public.roundtable_sessions
  add column if not exists domain text default 'auto',
  add column if not exists fact_briefing text,
  add column if not exists status text default 'completed';

comment on column public.roundtable_sessions.domain is '研議領域 (auto, finance, marketing, tech, hr)';
comment on column public.roundtable_sessions.fact_briefing is '資料專員出具之會前客觀事實簡報';
comment on column public.roundtable_sessions.status is '會議狀態 (waiting_boss, completed)';
