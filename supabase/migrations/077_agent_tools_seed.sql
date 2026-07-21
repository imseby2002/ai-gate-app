-- =============================================
-- AI GATE - Migration 077
-- Agent 框架：工具中繼資料種子
-- 目前這些工具都只做「查詢/分析/草稿」，不會真的花錢或對外聯絡，
-- 故 default_requires_approval 全為 false；Phase 2 起若新增「真的會送出」
-- 的工具（如寄信給客戶、下廣告訂單），需種入 default_requires_approval = true，
-- engine.ts 的 tickRun 才會自動幫它掛上核准關卡。
-- =============================================

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('web_search',            '網路搜尋',       '透過線上模型搜尋具時效性的網路資訊',                 'research', false, 'low'),
  ('notify_human',          '通知真人',       '主動推播訊息通知真人，不需等待回覆',                 'core',     false, 'low'),
  ('request_human_approval','請求真人核准',   '請求真人核准後才能繼續的高風險動作',                 'core',     false, 'low'),
  ('finish_run',            '結束執行',       '確認任務完成並結束本次執行',                         'core',     false, 'low'),
  ('get_company_context',   '讀取公司知識庫', '讀取公司知識庫',                                     'core',     false, 'low'),
  ('read_role_memory',      '讀取角色記憶',   '讀取此角色過去累積的長期記憶',                       'core',     false, 'low'),
  ('write_memory',          '寫入角色記憶',   '寫入一筆長期記憶',                                   'core',     false, 'low'),
  ('brainstorm_with_models','多模型腦力激盪', '讓多個模型扮演不同角色進行討論',                     'research', false, 'low'),
  ('collect_market_data',   '蒐集市場資料',   '從網路蒐集與關鍵字相關的原始資料',                   'marketing', false, 'low'),
  ('draft_marketing_copy',  '撰寫行銷文案',   '產出行銷文案或開發信草稿',                           'marketing', false, 'low'),
  ('analyze_market',        '市場分析',       '產出結構化市場/競品分析',                           'marketing', false, 'low'),
  ('plan_image_content',    '規劃配圖內容',   '規劃社群配圖文案腳本',                               'marketing', false, 'low'),
  ('plan_video_content',    '規劃短影音內容', '規劃短影音腳本',                                     'marketing', false, 'low')
ON CONFLICT (id) DO NOTHING;
