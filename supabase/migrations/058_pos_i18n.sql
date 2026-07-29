-- 菜單多語系欄位
alter table public.pos_categories
  add column if not exists translations jsonb not null default '{}',
  add column if not exists image_url text;

alter table public.pos_items
  add column if not exists translations jsonb not null default '{}';

comment on column public.pos_categories.translations is '{"zh-TW":{"name":"..."},"en":{"name":"..."},"vi":{"name":"..."}}';
comment on column public.pos_items.translations is '{"zh-TW":{"name":"...","description":"..."},...}';

-- 菜單圖片 Storage（公開讀取）
insert into storage.buckets (id, name, public)
values ('pos-menu', 'pos-menu', true)
on conflict (id) do nothing;
