# GEO Writer 功能設計文件

> 併入 AI GATE「行銷中心」的 GEO 內容產生＋追蹤功能。
> 入口：`src/app/(app)/apps/page.tsx` 的 `APP_CARDS` 加一張卡。

## 目標
讓使用者填一點資料（或自動抓公司資料），就產出「容易被 AI（ChatGPT/Perplexity/Google AIO/Gemini/Claude）引用」的文章，並能追蹤被引用狀況。
業務情境：im-tourist 越南峴港在地服務（人力派遣、包車、翻譯、台商代辦等），中越雙語。

## 被引用的 6 要素（每篇必做）
1. 開頭 40–60 字直接回答 2. H2/H3 問句標題 3. 列點/表格/FAQ
4. JSON-LD（FAQPage+Article+Organization） 5. E-E-A-T 署名+獨家數據
6. 放行 AI 爬蟲(robots)+SSR

## 核心設計：數據源可插拔（免費起步，付費無痛升級）
所有上層只認 `KeywordProvider` 介面，不認具體工具。

```ts
// src/lib/geo/providers/types.ts
export interface KeywordMetric {
  keyword: string
  volume: number | null
  volumeSource: 'measured' | 'estimated' | 'unknown'
  competition: number | null
  relatedQueries: string[]
  trend: 'rising' | 'flat' | 'falling' | null
}
export interface KeywordProvider {
  name: string
  getMetrics(seed: string, locale: string, location: string): Promise<KeywordMetric[]>
}
```

- 免費實作 `FreeKeywordProvider`：Google Autocomplete 公開 endpoint + Trends（volume 為 null）。
- 付費實作 `DataForSeoProvider`：未來加 `DATAFORSEO_*` 環境變數自動啟用。
- 切換：`getKeywordProvider()` 依 env 是否存在自動選，上層零改動。
- 用 fetch 接外部 API，不裝新套件。

## 機會分數（有沒有真實量都能算）
機會分數 = 搜尋訊號分 × 商業意圖分 × AI 端競爭稀缺分
- 搜尋訊號：有 volume 用 volume；沒有用 Autocomplete 出現位置代理
- 商業意圖：AI(haiku) 判定離成交多近
- AI 端競爭稀缺：Perplexity 查現有引用來源數量/品質
- UI 標數據來源：🟢實測 / 🟡推估 / ⚪AI推測

## 防內容農場（三機制）
1. 問句聚叢：相似問句合併，一叢一篇（非一問一篇）
2. 強制獨家層：exclusive_facts 沒填不准產出（真實報價/在地案例）
3. 產出查重：dedup_hash 比對，過高擋下提示合併
內容架構：1 篇 Pillar 支柱長文 + N 篇 Cluster 子題，彼此內鏈。

## AI 模型分層（省成本，沿用 createAnthropic pattern）
| 階段 | 模型 |
|---|---|
| 問句擴展/意圖分類/聚叢 | claude-haiku-4-5 |
| 產出文章+JSON-LD | claude-sonnet-4-6 |
| 旗艦潤稿（選用勾選） | claude-opus-4-8 |
| AI 端競爭偵測 | perplexity online（既有 provider） |

## 資料表（Supabase，含 RLS）
```
geo_projects     id, user_id, seed_topic, locale, exclusive_facts, created_at
geo_questions    id, project_id, question, intent(info/local/compare/transact),
                 volume, volume_source, competition_score, intent_score,
                 opportunity_score, cluster_id, status(suggested/selected/written)
geo_clusters     id, project_id, title, pillar(bool), question_ids[]
geo_articles     id, cluster_id, title, body_md, json_ld, exclusive_used,
                 dedup_hash, published_url, status
geo_tracking     id, question_id, engine, checked_at, cited(bool), rank, cited_sources[]
```

## API 端點（src/app/api/marketing/geo/）
- generate   haiku 抽取 + sonnet 成文 + JSON-LD
- questions  問句探勘 + 機會分數（呼叫 KeywordProvider + perplexity）
- track      cron 觸發，perplexity 查目標問句記錄引用
- publish    輸出 SSR 落地頁（或回傳給 WordPress）

## UI（行銷中心新增一張卡 → GEO Writer 頁）
流程：填主題+獨家資訊 → 出問句+機會分數+聚叢 → 勾叢 → 規劃 Pillar+Cluster
→ 逐篇產出(強制獨家層)+查重 → 文章+JSON-LD → 追蹤儀表板

## 既有可沿用地基（不裝新套件）
- Anthropic：`src/lib/ai/providers/claude.ts` + `createAnthropic`（範本 api/marketing/copy/route.ts）
- Perplexity：`src/lib/ai/providers/perplexity.ts`
- 公司資料抽取：`api/marketing/company-data`
- cron 認證：`src/lib/cron-auth.ts`（getCronOrUserAuth）
- Supabase：`src/lib/supabase/server.ts` / `admin.ts`
- 行銷中心入口卡：`src/app/(app)/apps/page.tsx` APP_CARDS

## 發佈策略（系統外）
主場 WordPress + RankMath，掛 marketing.im-tourist.com。系統可先「產出→複製貼到 WordPress」，
未來再做 publish webhook 直接發佈。

## 分步實作建議（每步可獨立交付）
- 步驟1 MVP：行銷中心加卡 + GEO 頁；輸入主題 → haiku 出問句分意圖 → 勾選 → sonnet 產 1 篇含 JSON-LD（先用暫存，不建表、不做機會分數/追蹤）
- 步驟2：建資料表 + 存專案/問句/文章
- 步驟3：機會分數（KeywordProvider 免費版 + perplexity 競爭）
- 步驟4：聚叢 + 防農場查重
- 步驟5：追蹤（track API + cron + 儀表板）
- 步驟6：越南文版、publish 落地頁/WordPress webhook

---

# 實作現況（已完成，超出原 6 步規劃）

> 以下為實際落地的模組、檔案、資料表與設定，含吸收自參考專案的擴充。
> 參考：geo-seo-claude（評分/審計/llms.txt/爬蟲檢查）、GEOFlow（多模式發佈）。

## 已完成模組對照
| 階段 | 功能 | 主要檔案 |
|---|---|---|
| 探勘 | 問句挖掘 + 意圖分類(haiku) | `api/marketing/geo/questions` |
| 評分 | 機會分數(Autocomplete+Perplexity) | `api/marketing/geo/score`、`lib/geo/providers/*`、`lib/geo/scoring.ts` |
| 規劃 | 聚叢 + 防農場三機制 | `api/marketing/geo/cluster`、`generate`(強制獨家層+查重) |
| 產出 | 6要素文章 + JSON-LD | `api/marketing/geo/generate` |
| 品質 | 段落可引用度評分 | `api/marketing/geo/citability`、`lib/geo/citability.ts` |
| 發佈 | 落地頁/WordPress原生/Webhook/匯出HTML | `api/marketing/geo/publish`、`app/geo/[id]`、`lib/geo/md.ts` |
| 多語 | 繁中/英/越南 | `api/marketing/geo/translate` |
| 追蹤 | Perplexity引用追蹤 + cron + per-project開關 | `api/marketing/geo/track`、`api/cron/geo-track`、`auto-track`、`lib/geo/track.ts` |
| 報告 | 競品SoV + 月度趨勢 + 可列印PDF | `api/marketing/geo/report`、`lib/geo/report.ts` |
| 技術審計 | AI爬蟲檢查 + llms.txt + GEO Score | `api/marketing/geo/{crawlers,llms,audit}`、`lib/geo/{crawlers,llms,audit}.ts` |
| 素材庫 | 商家/作者/事實複用 + Schema 注入 | `api/marketing/geo/material`、`lib/geo/schema.ts` |

UI 單頁：`src/app/(tools)/marketing/geo-writer/page.tsx`（入口卡＋側欄已接 `(tools)/marketing`）。
i18n：`messages/{zh-TW,en,vi}.json` 的 `Marketing.geo.*`。

## 資料表（實際；migrations 041–045）
- `geo_projects`：+ `author`、`target_domain`(使用者輸入追蹤網域)、`auto_track`(每週自動追蹤開關)
- `geo_questions` / `geo_clusters` / `geo_articles`(+`project_id`) / `geo_tracking`：同原設計
- `geo_publish_settings`(per-user)：wp_base_url/user/app_password、webhook_url/token
- `geo_material`(per-user)：business(jsonb)、authors(jsonb[])、facts(jsonb[])
- 全表 RLS：父表依 user_id，子表依所屬 project 擁有者。

## 發佈四模式（取代原「複製貼上」）
1. landing：本站 SSR `/geo/<id>`（免設定，放行 AI 爬蟲）
2. wordpress：WordPress 原生 REST `/wp-json/wp/v2/posts` + Application Password（含 Hostinger）
3. webhook：通用 webhook 給非 WP 的 CMS/API
4. export：含 JSON-LD 的獨立 HTML 下載（靜態網站/無後台）
> WordPress/Webhook 憑證由使用者於「發佈設定」面板填入（per-user），非 env。

## Schema 強化
原 Article+FAQPage+Organization → 素材庫存在時，`enrichJsonLd` 確定性注入 **LocalBusiness**（真實地址/電話/座標）與 **Person**（作者掛 Article.author/publisher），不靠 LLM 編造。

## 機會分數實作細節
搜尋訊號(FreeKeywordProvider：Google Autocomplete) × 商業意圖(step1 intent 映射) × AI端稀缺(Perplexity sonar 批次競爭偵測)；無 Perplexity 金鑰時稀缺退回中性值。UI 標 🟢實測/🟡推估/⚪AI推測。

## 引用追蹤與月報
- track：Perplexity 模擬提問→取回引用來源網域→判斷目標網域是否被引用/排名→寫 `geo_tracking`。
- cron `/api/cron/geo-track`：每週一 06:00，只跑 `auto_track=true` 專案，`GEO_TRACK_BATCH`(預設40) 控量。
- report：由 `geo_tracking` 歷史聚合被引用率趨勢、競品 share-of-voice、掉榜清單；`format=html` 出可列印報告（瀏覽器另存 PDF，未裝 PDF 套件）。

## 技術審計（lib/geo/audit.ts，GEO Score 0–100）
可引用度30 / 結構化資料20 / 技術基礎20 / E-E-A-T署名15 / AI爬蟲放行15。
爬蟲檢查涵蓋 14 個 UA：GPTBot、OAI-SearchBot、ChatGPT-User、ClaudeBot、anthropic-ai、PerplexityBot、Perplexity-User、Google-Extended、Applebot-Extended、Amazonbot、Bytespider、CCBot、Meta-ExternalAgent、cohere-ai。

## 環境變數（皆選用，未設有後備）
- 已有 `ANTHROPIC_API_KEY`、`PERPLEXITY_API_KEY`、`CRON_SECRET`。
- `GEO_TRACK_BATCH`(預設40)、`GEO_BRAND_DOMAIN`(後備，預設 im-tourist.com)。
- WordPress/Webhook 憑證改 per-user 設定；env `GEO_WP_*`、`GEO_WORDPRESS_*` 僅作全域後備。
- 未來付費關鍵字源：`DATAFORSEO_*`（`getKeywordProvider()` 自動切換）。

## 與原設計差異/決策
- 追蹤目標網域：改為使用者於專案輸入（非 env 寫死）。
- 自動追蹤：改為 per-project 開關，預設關閉（控成本）。
- PDF：因禁裝新套件，採可列印 HTML→瀏覽器另存 PDF。
- 發佈/憑證：per-user 設定面板。
- 暫未做（評估後續）：GEOFlow 多站批次排程量產、品牌提及外部掃描（YouTube/Reddit/Wikipedia）、prospect CRM（已有潛在客戶模組）。

---

## 商業背景（重要脈絡）
先用 freemium 服務驗證商機，再決定系統化深度：
- 免費鉤子：1 服務 1 篇做到被 AI 引用（限前 5 家），條件是對方提供真實報價/服務細節，並綁「做出效果幫忙轉介/頁面掛 im-tourist 製作」。
- 付費：多主題 + 修改維護 + 多語言 + 每月引用追蹤報告 + 對手監控 + 掉榜補強（月費，最關鍵賺錢點）。
- 主題清單（優先冷門無對手）：人力派遣、包車接送、中越翻譯、台商秘書代辦、長租代找、會安一日遊。
