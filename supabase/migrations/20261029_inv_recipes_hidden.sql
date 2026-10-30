-- 研發配方「隱藏」：暫不使用、日後可能再用（永久不用則刪除）
alter table public.inv_recipes add column if not exists hidden boolean not null default false;
