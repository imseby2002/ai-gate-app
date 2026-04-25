-- Telegram interactive approval records
-- Tracks pending approve/modify/reject requests sent via inline keyboard buttons

create table if not exists public.telegram_approvals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  chat_id         text not null,
  message_id      bigint,                          -- Telegram message_id of the approval request
  status          text not null default 'pending', -- pending | approved | rejected | awaiting_feedback | feedback
  feedback        text,
  context         jsonb default '{}'::jsonb,        -- arbitrary context (unitId, step, label, etc.)
  last_update_id  bigint default 0,                -- tracks getUpdates offset per approval
  created_at      timestamptz default now(),
  expires_at      timestamptz default (now() + interval '24 hours')
);

create index if not exists telegram_approvals_user_status_idx
  on public.telegram_approvals(user_id, status)
  where status in ('pending', 'awaiting_feedback');

alter table public.telegram_approvals enable row level security;

create policy "Users can manage own telegram approvals"
  on public.telegram_approvals for all
  using (auth.uid() = user_id);
