\## 回應風格

* 簡潔直接，不解釋原因
* 直接給答案或處理結果
* 不加前言、不加總結



\## 規則

**每次開始工作前**，先執行以下指令同步最新代碼（因為手機端可能有新 commit）：

```
git pull --rebase
```

若 pull 發現 merge conflict，告知我再繼續。

**每次修改程式碼完畢後**，自動執行以下指令（不需詢問，直接執行）：

1\. git add -A

2\. git commit -m "描述本次修改內容"

3\. git push

   \- 若 push 被拒（remote 有新 commit），自動執行 git pull --rebase 後再 push

   \- 不需要詢問我，自動處理衝突並完成 push

   \- 除非有 merge conflict 需要手動解決，才告知我




\## 專案架構



\*\*AI GATE\*\* — 企業內部 AI 服務平台，支援多模型對話、RAG 知識庫助理、行銷自動化流程與訂閱計費。


\### 技術棧

| 層 | 技術 |

|---|---|

| 框架 | Next.js 16 App Router + TypeScript |

| UI | React 19 + shadcn/ui + Radix UI + TailwindCSS 4 |

| 資料庫 | Supabase (PostgreSQL + Auth + Storage) |

| AI | Vercel AI SDK v6，多 provider：DeepSeek / Gemini / Claude / Groq / Perplexity |

| 圖片生成 | FAL AI (FLUX.1 Pro / Nano Banana) |

| 影片生成 | Kling / VEO3 |

| 計費 | Stripe（訂閱）+ ECPay（信用點數一次性購買） |

| 部署 | Vercel（主）+ Cloudflare Workers（備） |

| 狀態管理 | Zustand（客戶端）+ React Query v5（伺服器） |

| i18n | next-intl（繁中 / 簡中 / 英文） |




\### 目錄結構

src/

├── app/

│   ├── (admin)/          # 後台管理（role: admin）

│   ├── (app)/            # 主應用（已登入用戶）

│   ├── (auth)/           # 登入 / 註冊 / OAuth callback

│   ├── (standalone)/     # 行銷自動化獨立功能頁

│   └── api/              # 所有 API 路由

├── components/

│   ├── admin/            # 後台 UI

│   ├── assistants/       # RAG 助理 UI

│   ├── chat/             # 對話介面

│   ├── marketing/        # 行銷自動化 UI

│   ├── settings/         # 用戶設定

│   ├── usage/            # 用量 / 帳單

│   └── ui/               # shadcn 基礎元件

├── lib/

│   ├── ai/

│   │   ├── providers/    # 各 provider 的 streaming adapter

│   │   ├── router.ts     # 意圖偵測 + 自動選模型

│   │   └── context-builder.ts  # system prompt 建構 / RAG 注入

│   ├── supabase/         # Supabase client（server / browser / admin）

│   ├── stripe/           # Stripe helpers

│   └── ecpay/            # ECPay helpers

├── types/

│   └── database.ts       # 所有 DB table 的 TypeScript interface

└── i18n/                 # next-intl messages

supabase/migrations/      # 17 支 SQL migration（依序執行）

bridge/                   # Cloudflare Workers 入口



\### 重要決策



\#### 1. 智慧路由 (`src/lib/ai/router.ts`)

\- 7 種意圖（daily / finance / creative / analysis / legal / vision / image-gen / video-gen）

\- 關鍵字匹配 → 最適模型：DeepSeek（財務）、Gemini（創意）、Claude（分析）、Perplexity（法律搜尋）

\- 用戶可手動覆蓋



\#### 2. RAG 模式 (`src/app/api/assistants/\[id]/files`)

\- 上傳 PDF / DOCX / XLSX / 圖片 / JSON / TXT → 萃取文字存 DB

\- 對話時注入 system prompt，最大 200K 字元

\- 狀態流：pending → processing → done / failed



\#### 3. 三級用戶模型

| 類型 | 說明 |

|---|---|

| employee | 員工，免費使用，月預算追蹤 |

| external | 外部用戶，信用點數制（餘額 < $0.01 USD 封鎖） |

| admin | 全平台管理（模型 / 用戶 / 白名單） |



\#### 4. 計費架構

\- \*\*Stripe\*\*：starter / pro / enterprise 訂閱方案

\- \*\*ECPay\*\*：台灣金流一次性點數購買

\- 每則訊息記錄 input\_tokens + output\_tokens + cost\_usd + latency\_ms

\- 信用異動走 `credit\_transactions` 帳本



\#### 5. 行銷自動化流水線 (`src/app/api/marketing/`)

\- 步驟：collect → analyze → copy → generate-image → generate-video → script → publish

\- 每步驟支援 Telegram 審核回饋

\- JSONB 欄位記錄各步驟狀態 / 產出

\- Vercel Cron 每日 UTC 08:00 執行 `/api/cron/pipeline`



\---



\### 常用路徑 / 規則



\#### API 路由規則

\- 所有 API 在 `src/app/api/` 下，回傳 `Response`（App Router 格式）

\- 認證：從 `supabase/server` 取 user，未登入回 `401`

\- 餘額不足回 `402`，帳號停用回 `403`

\- Admin 路由：`/api/admin/\*\*` 需驗證 `profile.user\_type === 'admin'`



\#### 資料庫規則

\- Migration 檔位於 `supabase/migrations/`，命名 `NNN\_描述.sql`

\- 所有 table 啟用 RLS，policy 在各 migration 內定義

\- 查 DB 用 `createClient()` from `src/lib/supabase/server.ts`（Server Component / Route Handler）

\- Admin 操作用 `createAdminClient()` from `src/lib/supabase/admin.ts`（跳過 RLS）



\#### AI 呼叫規則

\- 統一走 `src/app/api/chat/route.ts`，不在 component 直接呼叫 AI SDK

\- Provider adapter 放 `src/lib/ai/providers/`，每個 adapter export `streamText` wrapper

\- 新增模型：(1) 加 provider adapter，(2) 在 `ai\_models` table 插入記錄，(3) 更新 router.ts 意圖對應



\#### 環境變數

```

\# Supabase

NEXT\_PUBLIC\_SUPABASE\_URL

NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY

SUPABASE\_SERVICE\_ROLE\_KEY



\# AI Providers

DEEPSEEK\_API\_KEY / GOOGLE\_AI\_API\_KEY / ANTHROPIC\_API\_KEY

PERPLEXITY\_API\_KEY / FAL\_AI\_API\_KEY / KLING\_API\_KEY / VEO\_API\_KEY



\# 計費

STRIPE\_SECRET\_KEY / STRIPE\_WEBHOOK\_SECRET / NEXT\_PUBLIC\_STRIPE\_PUBLISHABLE\_KEY

STRIPE\_STARTER\_PRICE\_ID / STRIPE\_PRO\_PRICE\_ID



\# 應用

NEXT\_PUBLIC\_APP\_URL

```



\#### 元件規則

\- UI 元件從 `src/components/ui/` import（shadcn）

\- 功能元件依模組分資料夾（chat / marketing / assistants...）

\- 所有 component 用函式元件 + TypeScript，無 class component

\- 暗色模式透過 `next-themes` + Tailwind `dark:` 前綴



\#### 多語系規則

\- 翻譯 key 放 `src/i18n/messages/zh-TW.json`、`en.json` 等

\- Server Component 用 `getTranslations()`，Client Component 用 `useTranslations()`

\- 語言切換 API：`/api/locale`

