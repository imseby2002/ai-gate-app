-- Migration 008: Cover Letter Templates

CREATE TABLE IF NOT EXISTS public.cover_letter_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('formal','creative','career-change','entry-level','executive')),
  content     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cover_letter_templates ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_all_cover_letter_templates"
  ON public.cover_letter_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Authenticated users can read active templates
CREATE POLICY "auth_read_active_cover_letter_templates"
  ON public.cover_letter_templates FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_cover_letter_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_cover_letter_templates_updated_at
  BEFORE UPDATE ON public.cover_letter_templates
  FOR EACH ROW EXECUTE FUNCTION update_cover_letter_templates_updated_at();

-- ── Seed 5 templates ─────────────────────────────────────────────

INSERT INTO public.cover_letter_templates (name, description, category, sort_order, content) VALUES

('傳統正式型', '適用金融、公務、大型企業；保守文化職場，強調穩重與資歷', 'formal', 1,
'[您的姓名]
[電話號碼] | [電子郵件信箱]
[日期]

[公司名稱]
[收件人姓名] [職稱，例如：人力資源部 王經理]

主旨：應徵 [職位名稱] 乙職

敬愛的 [收件人姓氏][先生/女士]：

一、自我介紹

本人 [您的姓名]，[最高學歷] 畢業，現任職於 [現任公司]，擔任 [現任職稱]，具備 [年數] 年 [產業/領域] 相關工作經驗。經由 [徵才管道] 得知 [職位名稱] 職缺，深感符合本人職涯規劃，特此備函應徵。

二、專業能力與經歷

本人在過去任職期間，主要負責 [核心工作職責]，並累積以下具體成果：

・[成就一，含量化數據，例如：成功帶領 5 人團隊完成系統導入，節省成本 NT$500,000]
・[成就二，例如：客戶滿意度由 78% 提升至 94%]
・[成就三，例如：取得 [專業證照名稱]]

本人具備 [核心技能一]、[核心技能二] 及 [核心技能三]，相信能切實符合貴公司對此職位的期望。

三、對貴公司的認識與動機

長期以來，本人對 [公司名稱] 在 [產業/領域] 之 [具體表現] 深感認同。貴公司 [具體事項] 令本人印象深刻，期望能在此環境中持續精進，為團隊貢獻一己之力。

四、結語

隨函附上本人履歷表，敬請參閱。期盼能有機會親赴貴公司面試，進一步說明本人之資歷與熱忱。

感謝您撥冗閱覽，順頌

商祺

[您的姓名] 謹啟
[聯絡電話] | [電子郵件信箱]'),

('現代創意型', '適用科技新創、設計、行銷傳播業；強調個性、創新思維', 'creative', 2,
'[您的姓名]
[電話] | [Email] | [作品集 URL] | [LinkedIn]
[日期]

致 [公司名稱] [部門名稱]
[收件人姓名]（若不確定可填：Hiring Team）

Hi [收件人名字]，

【為什麼是我？】

我是 [您的姓名]，一位專注於 [您的專業領域] 的 [職稱/身份]。我在 [前公司名稱] 的 [具體成果，例如：用戶增長計畫中，將核心功能轉換率提升了 37%]，讓我確信：好的 [設計/行銷/產品] 不只是美觀，而是能解決真實問題。

當我看到 [公司名稱] 正在招募 [職位名稱] 時，我知道這是我想參與的下一個挑戰。

【我能帶來什麼？】

在 [年數] 年的 [領域] 工作中，我累積了：

・[技能/成就一，例如：主導 3 個跨平台產品從 0 到 1 的完整流程]
・[技能/成就二，例如：熟練操作 Figma、Framer、Adobe Creative Suite]
・[技能/成就三，例如：具備使用者研究與 A/B Testing 實務經驗]

我特別擅長 [您的差異化強項]，這也是我觀察到 [公司名稱] 目前正在聚焦的方向。

【為什麼是貴公司？】

我非常欣賞 [公司名稱] 近期在 [具體事項] 上的嘗試。貴公司的產品哲學——[您對公司文化的觀察]——與我的工作信念高度契合。

【下一步】

我的作品集：[作品集網址]

期待有機會與您分享更多想法！

[您的姓名]'),

('轉職型', '適合跨領域換跑道者，需說明轉職動機並強調可遷移技能', 'career-change', 3,
'[您的姓名]
[電話] | [Email] | [LinkedIn]
[日期]

[公司名稱]
[收件人姓名及職稱]

主旨：應徵 [目標職位名稱] — [您的姓名]

敬愛的 [收件人姓氏][先生/女士]，您好：

【轉職動機】

我目前在 [現任產業] 擔任 [現職稱] 已有 [年數] 年，累積了扎實的 [核心能力] 能力。近年來，我對 [目標新產業] 產生強烈興趣，並透過 [自學方式，例如：修習 Google Data Analytics Certificate] 積極轉型。

這次應徵 [公司名稱] 的 [目標職位名稱]，正是我職涯規劃的關鍵一步。

【可遷移技能（Transferable Skills）】

雖然正式工作背景以 [舊產業] 為主，但以下能力能直接應用於 [目標職位]：

・[遷移技能一，例如：數據處理與視覺化（Python/Tableau）→ 可應用於行銷數據分析]
・[遷移技能二，例如：跨部門溝通 → 可應用於跨功能團隊協作]
・[遷移技能三，例如：高品質報告撰寫 → 可應用於客戶提案]

此外，我已完成 [相關進修或證照]，持續強化目標領域的專業知識。

【具體案例】

在 [前職/前公司] 任職期間，我曾 [跨領域相關案例]，此經驗讓我對 [目標領域] 有第一手的實務理解。

【結語】

隨函附上履歷表，期盼能有機會當面說明我的轉職規劃與決心。感謝您的寶貴時間。

敬祝 商祺

[您的姓名] 敬上
[電話] | [Email]'),

('應屆畢業生型', '適合剛畢業或即將畢業；以學術成就、實習、社團與潛力為賣點', 'entry-level', 4,
'[您的姓名]
[就讀學校]，[科系]，[預計畢業年月]
[電話] | [Email] | [LinkedIn/GitHub（選填）]
[日期]

[公司名稱]
[收件人姓名及職稱]

主旨：應徵 [職位名稱]（全職/實習）— [您的姓名]

您好：

【自我介紹與應徵動機】

我是 [您的姓名]，目前就讀 [學校名稱] [科系名稱] [年級/即將畢業]。求學期間，學習重心聚焦於 [核心學科]，並透過 [實習/研究/專題] 累積了初步實務經驗。

得知 [公司名稱] 招募 [職位名稱]，認為此機會與我的學習背景及未來目標高度吻合，故冒昧應徵。

【相關學習與實習經歷】

1. 實習經驗
   [實習公司名稱]，[實習職稱]（[起訖時間]）
   ・[具體工作內容，例如：協助製作市場分析報告]
   ・[具體成果，例如：參與的專案節省部門 15% 的資料處理時間]

2. 學術專題
   [專題名稱]（[時間]）
   ・[內容說明，例如：以機器學習預測台灣股市波動，模型準確率達 82%]

3. 社團／課外活動
   [社團名稱]，[擔任職務]（[時間]）
   ・[領導力或軟實力說明]

【技能與語言】

技術技能：[技能一] / [技能二] / [技能三]
語言能力：中文（母語）/ 英文（[多益/IELTS 分數]）
軟實力：快速學習、抗壓性強、團隊溝通

【熱忱與期望】

[公司名稱] 在 [產業特色] 中的地位令我印象深刻。期盼能在貴公司環境中，將課堂所學轉化為真實價值，向優秀前輩持續學習。

隨函附上履歷表，懇請惠覽。期待有機會進一步交流。

謝謝您的時間與考量。

[您的姓名] 敬上
[電話] | [Email]'),

('主管高階型', '適用總監、VP、C-Suite；強調策略視野、領導力成果與商業影響力', 'executive', 5,
'[您的姓名]
[職稱，例如：資深行銷總監]
[電話] | [Email] | [LinkedIn]
[日期]

[公司名稱]
[收件人職稱，例如：執行長室 / 董事會]
[收件人姓名]（若知悉）

主旨：高階主管應徵 — [目標職位名稱]

[收件人姓氏][先生/女士]，您好：

【策略定位】

我在 [產業名稱] 深耕逾 [年數] 年，歷任 [職稱一] 至 [職稱二]，帶領過最大規模達 [人數] 人的跨功能團隊，負責 [最大規模業務或預算] 之策略規劃與執行。

貴公司目前在 [策略課題，例如：東南亞市場擴張 / 數位轉型] 上的佈局，與我過去的核心領域高度契合，促使我主動提出此應徵。

【領導力成果（量化）】

1. [成果一，例如：在 [前公司] 擔任 VP of Sales 期間，18 個月內將年營收由 NT$8 億提升至 NT$14 億，YoY 成長 75%]

2. [成果二，例如：主導三品牌組織整合，年度人力成本節省 NT$3,000 萬]

3. [成果三，例如：帶領技術團隊 12 個月完成核心系統雲端化遷移，維運成本降低 35%]

【策略視野與契合點】

就我的觀察，[公司名稱] 下一階段的關鍵課題在於 [您對公司策略的深刻分析]。我曾在 [前公司] 面對類似挑戰，採用 [解決方案摘要]，最終達成 [成果]。此經驗可為貴公司帶來直接且可衡量的價值。

【領導哲學】

我深信優秀的領導者應當 [您的領導原則]。在我帶領的團隊中，員工自願留任率平均高於產業標準 [數字]%。

【結語】

我深知高階職位的聘用決策需要充分評估，歡迎安排深度對談。

附件：個人履歷 / Executive Profile

敬祝 鈞安

[您的姓名]
[職稱]
[電話] | [Email] | [LinkedIn]');
