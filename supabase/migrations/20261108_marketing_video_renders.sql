-- 多分鏡配音影片（Story Video）合成任務
-- 主 app 建立任務（queued）→ 獨立 worker 領取（rendering）逐段產圖＋配音、合成 → 回報 done/failed
create table if not exists public.marketing_video_renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'failed')),
  title text,
  template text not null default 'classic',
  aspect text not null default '9:16',
  voice_id text not null,
  bgm boolean not null default false,
  -- [{ narration, visual_prompt, image_url?, audio_url? }]
  scenes jsonb not null default '[]'::jsonb,
  output_url text,
  duration_sec numeric,
  cost_usd numeric not null default 0,
  error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_video_renders_status_idx on public.marketing_video_renders (status, created_at);
create index if not exists marketing_video_renders_user_idx on public.marketing_video_renders (user_id, created_at desc);

alter table public.marketing_video_renders enable row level security;

-- 使用者只能讀自己的任務；寫入一律走 service role（API / worker）
drop policy if exists "own video renders" on public.marketing_video_renders;
create policy "own video renders" on public.marketing_video_renders
  for select using (user_id = auth.uid());
