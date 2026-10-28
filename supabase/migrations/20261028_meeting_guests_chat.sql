-- 會議：訪客免登入加入（面試者）、文字聊天、檔案上傳
alter table public.meetings add column if not exists allow_guests boolean not null default false;

-- 訪客（不需帳號）；以伺服器簽發的 token 識別
create table if not exists public.meeting_guests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.meeting_guests enable row level security;
create index if not exists meeting_guests_meeting_idx on public.meeting_guests(meeting_id);

-- 聊天訊息（成員與訪客共用；一律經由 API 存取）
create table if not exists public.meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('user', 'guest')),
  sender_id uuid not null,
  sender_name text not null default '',
  body text not null default '',
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);
alter table public.meeting_messages enable row level security;
create index if not exists meeting_messages_meeting_idx on public.meeting_messages(meeting_id, created_at);

-- 檔案（私有，透過簽章網址上傳／下載）
insert into storage.buckets (id, name, public, file_size_limit)
values ('meeting-files', 'meeting-files', false, 52428800)
on conflict (id) do nothing;
