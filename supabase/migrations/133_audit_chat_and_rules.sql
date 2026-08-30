-- 稽核 AI 對談與硬性規則
create table if not exists audit_chats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null default '',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audit_chats_owner_idx on audit_chats(owner_id, updated_at desc);
alter table audit_chats enable row level security;
create policy audit_chats_admin on audit_chats for all using (is_admin());
create policy audit_chats_owner on audit_chats for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists audit_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references audit_chats(id) on delete cascade,
  owner_id uuid not null,
  role text not null,               -- user | assistant
  content text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_messages_chat_idx on audit_messages(chat_id, created_at);
alter table audit_messages enable row level security;
create policy audit_messages_admin on audit_messages for all using (is_admin());
create policy audit_messages_owner on audit_messages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 硬性規定：稽核者與 AI 討論後定案，AI 之後自動套用
create table if not exists audit_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null default '',   -- 空＝適用所有門市
  rule text not null,
  active boolean not null default true,
  source_chat_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audit_rules_owner_idx on audit_rules(owner_id, store);
alter table audit_rules enable row level security;
create policy audit_rules_admin on audit_rules for all using (is_admin());
create policy audit_rules_owner on audit_rules for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
