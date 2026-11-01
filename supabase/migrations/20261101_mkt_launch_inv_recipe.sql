-- 研發頁（inv_recipes）推送新品上架：記錄來源配方，用來顯示「已推送」並避免重複推送
alter table public.mkt_product_launches add column if not exists inv_recipe_id uuid references public.inv_recipes(id) on delete set null;
create index if not exists mkt_product_launches_inv_recipe_idx on public.mkt_product_launches(owner_id, inv_recipe_id);
