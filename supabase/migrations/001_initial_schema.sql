-- =============================================
-- AI GATE - Database Schema
-- Migration 001: Core Tables
-- =============================================

-- ===== USER PROFILES =====
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,
  user_type       TEXT NOT NULL DEFAULT 'employee'
                  CHECK (user_type IN ('employee', 'external', 'admin')),
  is_active       BOOLEAN DEFAULT true,
  department      TEXT,
  monthly_budget  NUMERIC(10,4),
  credit_balance  NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ===== SUBSCRIPTIONS =====
CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT UNIQUE,
  stripe_sub_id         TEXT UNIQUE,
  plan_id               TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan_id IN ('free','starter','pro','enterprise')),
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','canceled','past_due','trialing')),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ===== AI MODELS REGISTRY =====
CREATE TABLE public.ai_models (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  provider            TEXT NOT NULL
                      CHECK (provider IN ('deepseek','google','anthropic','perplexity','fal','kling','veo')),
  modality            TEXT NOT NULL
                      CHECK (modality IN ('text','image','video','multimodal')),
  input_cost_per_1k   NUMERIC(10,8) DEFAULT 0,
  output_cost_per_1k  NUMERIC(10,8) DEFAULT 0,
  image_cost_per_unit NUMERIC(10,6) DEFAULT 0,
  video_cost_per_sec  NUMERIC(10,6) DEFAULT 0,
  context_window      INTEGER,
  supports_vision     BOOLEAN DEFAULT false,
  supports_files      BOOLEAN DEFAULT false,
  is_enabled          BOOLEAN DEFAULT true,
  routing_tags        TEXT[],
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ===== ASSISTANTS =====
CREATE TABLE public.assistants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  system_prompt   TEXT NOT NULL DEFAULT '',
  default_model   TEXT REFERENCES public.ai_models(id),
  avatar_emoji    TEXT DEFAULT '🤖',
  is_public       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ===== ASSISTANT FILES =====
CREATE TABLE public.assistant_files (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id        UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id),
  file_name           TEXT NOT NULL,
  file_type           TEXT NOT NULL
                      CHECK (file_type IN ('pdf','docx','xlsx','jpg','jpeg','png','json','txt')),
  storage_path        TEXT NOT NULL,
  file_size_bytes     INTEGER,
  extracted_text      TEXT,
  chunk_count         INTEGER DEFAULT 0,
  processing_status   TEXT DEFAULT 'pending'
                      CHECK (processing_status IN ('pending','processing','done','failed')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ===== CONVERSATIONS =====
CREATE TABLE public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assistant_id    UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
  title           TEXT DEFAULT 'New Chat',
  model_id        TEXT REFERENCES public.ai_models(id),
  pinned          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ===== MESSAGES =====
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  model_id        TEXT REFERENCES public.ai_models(id),
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  cost_usd        NUMERIC(10,8) DEFAULT 0,
  image_urls      TEXT[],
  video_url       TEXT,
  file_refs       UUID[],
  latency_ms      INTEGER,
  finish_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ===== USAGE DAILY AGGREGATES =====
CREATE TABLE public.usage_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model_id        TEXT NOT NULL REFERENCES public.ai_models(id),
  date            DATE NOT NULL,
  message_count   INTEGER DEFAULT 0,
  input_tokens    BIGINT DEFAULT 0,
  output_tokens   BIGINT DEFAULT 0,
  image_count     INTEGER DEFAULT 0,
  video_seconds   NUMERIC(10,2) DEFAULT 0,
  total_cost_usd  NUMERIC(10,6) DEFAULT 0,
  UNIQUE(user_id, model_id, date)
);

-- ===== CREDIT LEDGER =====
CREATE TABLE public.credit_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usd            NUMERIC(10,4) NOT NULL,
  type                  TEXT NOT NULL
                        CHECK (type IN ('purchase','usage','refund','admin_grant')),
  ecpay_trade_no        TEXT,
  message_id            UUID REFERENCES public.messages(id),
  description           TEXT,
  balance_after         NUMERIC(10,4),
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ===== INDEXES =====
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX idx_usage_daily_user_date ON public.usage_daily(user_id, date DESC);
CREATE INDEX idx_assistant_files_assistant ON public.assistant_files(assistant_id);
CREATE INDEX idx_assistants_user_id ON public.assistants(user_id);
