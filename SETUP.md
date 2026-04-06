# AI GATE 安裝與設定指南

## 技術架構

- **Frontend/Backend**: Next.js 16 (App Router) + TypeScript
- **資料庫 & 身份驗證**: Supabase (PostgreSQL + Auth + Storage)
- **付費**: Stripe
- **AI 模型**: DeepSeek, Gemini, Claude, Perplexity, FAL AI, Kling, VEO

---

## 第一步：Supabase 設定

1. 前往 [supabase.com](https://supabase.com) 建立新專案
2. 在 **SQL Editor** 中依序執行以下 migration 檔案：
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_functions_triggers.sql`
   - `supabase/migrations/004_seed_data.sql`
3. 建立 Storage Buckets：
   - **assistant-files**（Private，限制 50MB）
   - **generated-media**（Private）
4. 在 **Authentication → Settings** 中：
   - 啟用 Email 登入
   - 設定 Site URL 為 `http://localhost:3000`
   - 設定 Redirect URLs 加入 `http://localhost:3000/callback`
5. 複製 Project URL 和 API Keys

---

## 第二步：建立 .env.local

複製 `.env.example` 為 `.env.local` 並填入：

```bash
cp .env.example .env.local
```

```env
# Supabase（必填）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# AI 提供商（填入你持有的 API Key）
DEEPSEEK_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
FAL_AI_API_KEY=...            # https://fal.ai
KLING_API_KEY=...             # https://klingai.com
VEO_API_KEY=...               # Google VEO3（需要申請）

# Stripe（外部用戶付費功能）
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

# 應用程式
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 第三步：設定管理員帳號

1. 先正常註冊帳號（使用你的 email）
2. 在 Supabase SQL Editor 執行：

```sql
UPDATE public.profiles
SET user_type = 'admin'
WHERE email = 'your@email.com';
```

之後即可用此帳號進入 `/admin` 後台管理。

---

## 第四步：啟動開發伺服器

```bash
cd ai-gate-app
npm run dev
```

開啟瀏覽器：[http://localhost:3000](http://localhost:3000)

---

## 功能路由說明

| 路徑 | 功能 |
|------|------|
| `/` | 行銷首頁 |
| `/login` | 員工/用戶登入 |
| `/register` | 新用戶註冊 |
| `/dashboard` | 主控台（使用統計概覽） |
| `/chat` | AI 對話（自動路由模型） |
| `/chat/[id]` | 歷史對話 |
| `/assistants` | 我的 AI 助理列表 |
| `/assistants/new` | 建立新助理 |
| `/assistants/[id]` | 編輯助理 + 上傳知識庫 |
| `/image-gen` | 圖片生成（FLUX / Nano Banana） |
| `/video-gen` | 影片生成（VEO3 / Kling） |
| `/usage` | Token 用量與費用統計 |
| `/settings` | 個人設定 + 訂閱方案 |
| `/admin` | 後台管理（限 admin） |
| `/admin/users` | 用戶管理 |
| `/admin/models` | 模型開關與費率設定 |
| `/admin/usage` | 平台整體用量統計 |

---

## 智能模型路由

系統自動根據訊息內容選擇最合適的模型：

| 使用情境 | 模型 |
|---------|------|
| 日常對話 | DeepSeek Chat |
| 財務 / 數學推理 | DeepSeek Reasoner (R1) |
| 創意 / 行銷文案 | Gemini 2.0 Flash |
| 深度分析 | Claude Opus 4.5 |
| 法條 / 搜尋查詢 | Perplexity Sonar Pro |
| 圖片 / OCR | Gemini Vision |
| 圖片生成 | FLUX.1 Pro / Nano Banana |
| 影片生成 | VEO3 / Kling V2 |

用戶可在對話介面手動覆蓋選擇任何模型。

---

## 部署至 Vercel

```bash
npx vercel --prod
```

記得在 Vercel 環境變數中填入所有 `.env.local` 的內容，
並將 `NEXT_PUBLIC_APP_URL` 改為你的正式網域。

Stripe Webhook 設定：
- Endpoint URL: `https://your-domain.com/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
