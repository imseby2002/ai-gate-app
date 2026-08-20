-- =============================================
-- AI GATE - Migration 112
-- 智能差異：產品分類(飲料/TOPPING)＋交叉檢核設定。
-- 實耗改用 IVT：期初＋叫貨(入庫)−期末。配方允許負值（TOPPING 排擠基底）。
-- =============================================

-- 產品分類：drink(飲料) / topping(加料) / other
alter table public.inv_product_map
  add column if not exists kind text not null default '';

-- 交叉檢核用：指定杯子/茶/奶精原料碼，與每杯基準用量
alter table public.inv_settings
  add column if not exists cup_code       text not null default '',
  add column if not exists tea_code       text not null default '',
  add column if not exists creamer_code   text not null default '',
  add column if not exists tea_per_cup    numeric not null default 0,
  add column if not exists creamer_per_cup numeric not null default 0;
