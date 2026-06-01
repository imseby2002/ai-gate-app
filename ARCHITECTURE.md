# AI GATE — 架構文檔

企業內部 AI 服務平台，支援多模型對話、RAG 知識庫助理、行銷自動化流程與訂閱計費。

## 技術棧

| 層 | 技術 |
|---|---|
| 框架 | Next.js 16 App Router + TypeScript |
| UI | React 19 + shadcn/ui + Radix UI + TailwindCSS 4 |
| 資料庫 | Supabase (PostgreSQL + Auth + Storage) |
| AI | Vercel AI SDK v6：DeepSeek / Gemini / Claude / Groq / Perplexity |
| 圖片生成 | FAL AI (FLUX.1 Pro / Nano Banana) |
| 影片生成 | Kling / VEO3 |
| 計費 | Stripe（訂閱）+ ECPay（信用點數） |
| 部署 | Vercel（主）+ Cloudflare Workers（備） |
| i18n | next-intl（繁中 / 簡中 / 英文） |

## 目錄結構

```
src/
├── app/
│   ├── (admin)/           # 後台管理（role: admin）
│   ├── (app)/             # 主應用（已登入用戶）
│   ├── (auth)/            # 登入 / 註冊 / OAuth callback
│   ├── (standalone)/      # 行銷自動化獨立功能頁
│   └── api/               # 所有 API 路由
├── components/
│   ├── admin/             # 後台 UI
│   ├── assistants/        # RAG 助理 UI
│   ├── chat/              # 對話介面
│   ├── marketing/         # 行銷自動化 UI
│   └── ui/                # shadcn 基礎元件
├── lib/
│   ├── ai/
│   │   ├── providers/     # 各 provider 的 streaming adapter
│   │   ├── router.ts      # 意圖偵測 + 自動選模型
│   │   └── context-builder.ts  # system prompt / RAG 注入
│   ├── supabase/          # Supabase client
│   ├── stripe/            # Stripe helpers
│   └── ecpay/             # ECPay helpers
└── types/
    └── database.ts        # DB table interfaces
```

## 核心決策

### 1. 智慧路由 (`src/lib/ai/router.ts`)
- 7 種意圖：daily / finance / creative / analysis / legal / vision / image-gen / video-gen
- 關鍵字匹配 → 最適模型：DeepSeek（財務）、Gemini（創意）、Claude（分析）、Perplexity（法律搜尋）
- 用戶可手動覆蓋

### 2. RAG 模式 (`src/app/api/assistants/[id]/files`)
- 上傳 PDF / DOCX / XLSX / 圖片 / JSON / TXT → 萃取文字存 DB
- 對話時注入 system prompt，最大 200K 字元
- 狀態流：pending → processing → done / failed

### 3. 三級用戶模型
| 類型 | 說明 |
|---|---|
| employee | 員工，免費使用，月預算追蹤 |
| external | 外部用戶，信用點數制（餘額 < $0.01 USD 封鎖） |
| admin | 全平台管理 |

### 4. 計費架構
- **Stripe**：starter / pro / enterprise 訂閱
- **ECPay**：台灣金流一次性點數購買
- 每則訊息記錄：input_tokens + output_tokens + cost_usd + latency_ms
- 信用異動走 `credit_transactions` 帳本

### 5. 行銷自動化流水線 (`src/app/api/marketing/`)
- 步驟：collect → analyze → copy → generate-image → generate-video → script → publish
- 每步驟支援 Telegram 審核回饋
- Vercel Cron 每日 UTC 08:00 執行 `/api/cron/pipeline`

## 開發規則

### API 路由
- 所有 API 在 `src/app/api/` 下，回傳 `Response`（App Router 格式）
- 認證：從 `supabase/server` 取 user，未登入回 `401`
- 餘額不足回 `402`，帳號停用回 `403`
- Admin 路由 `/api/admin/**` 需驗證 `profile.user_type === 'admin'`

### 資料庫
- Migration 位於 `supabase/migrations/`，命名 `NNN_描述.sql`
- 所有 table 啟用 RLS
- 查 DB：`createClient()` from `src/lib/supabase/server.ts`
- 管理員操作：`createAdminClient()` from `src/lib/supabase/admin.ts`（跳過 RLS）

### AI 呼叫
- 統一走 `src/app/api/chat/route.ts`，不在 component 直接呼叫
- Provider adapter 放 `src/lib/ai/providers/`，export `streamText` wrapper
- 新增模型：(1) 加 adapter，(2) 在 `ai_models` table 插入，(3) 更新 router.ts

### 環境變數
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI Providers
DEEPSEEK_API_KEY
GOOGLE_AI_API_KEY
ANTHROPIC_API_KEY
PERPLEXITY_API_KEY
FAL_AI_API_KEY
KLING_API_KEY / VEO_API_KEY

# 計費
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_STARTER_PRICE_ID / STRIPE_PRO_PRICE_ID

# 應用
NEXT_PUBLIC_APP_URL
```

### 元件規則
- UI 元件從 `src/components/ui/` import（shadcn）
- 功能元件依模組分資料夾
- 函式元件 + TypeScript，無 class component
- 暗色模式：`next-themes` + Tailwind `dark:` 前綴

### 多語系
- 翻譯 key：`src/i18n/messages/{zh-TW,en,zh-CN}.json`
- Server：`getTranslations()`
- Client：`useTranslations()`
- 切換 API：`/api/locale`
