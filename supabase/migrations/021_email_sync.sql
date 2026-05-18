-- ============================================================
-- 021: Email 同步設定
-- ============================================================

create table if not exists email_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  property_id      uuid references properties(id) on delete set null,
  email_address    text not null,
  imap_host        text not null,
  imap_port        int  not null default 993,
  imap_user        text not null,
  imap_password    text not null,
  imap_folder      text not null default 'INBOX',
  sync_enabled     boolean not null default true,
  last_synced_at   timestamptz,
  last_synced_uid  bigint,
  last_sync_count  int,
  last_sync_error  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table email_settings enable row level security;
create policy "email_settings: owner" on email_settings for all using (auth.uid() = user_id);

create index if not exists email_settings_user on email_settings(user_id, sync_enabled);