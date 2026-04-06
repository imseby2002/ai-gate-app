-- =============================================
-- AI GATE - Row Level Security Policies
-- Migration 002: RLS
-- =============================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

-- Helper function: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  );
$$;

-- PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin());

-- SUBSCRIPTIONS
CREATE POLICY "subscriptions_own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscriptions_admin" ON public.subscriptions
  FOR ALL USING (public.is_admin());

-- ASSISTANTS
CREATE POLICY "assistants_own_all" ON public.assistants
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "assistants_public_read" ON public.assistants
  FOR SELECT USING (is_public = true AND auth.role() = 'authenticated');

CREATE POLICY "assistants_admin" ON public.assistants
  FOR ALL USING (public.is_admin());

-- ASSISTANT FILES
CREATE POLICY "assistant_files_own" ON public.assistant_files
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "assistant_files_admin" ON public.assistant_files
  FOR ALL USING (public.is_admin());

-- CONVERSATIONS
CREATE POLICY "conversations_own" ON public.conversations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "conversations_admin" ON public.conversations
  FOR SELECT USING (public.is_admin());

-- MESSAGES (conversation_id can be null for image/video generation logs)
CREATE POLICY "messages_own" ON public.messages
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "messages_admin" ON public.messages
  FOR SELECT USING (public.is_admin());

-- USAGE DAILY
CREATE POLICY "usage_daily_own" ON public.usage_daily
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- CREDIT TRANSACTIONS
CREATE POLICY "credits_own" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "credits_admin" ON public.credit_transactions
  FOR ALL USING (public.is_admin());

-- AI MODELS (readable by all authenticated)
CREATE POLICY "ai_models_read" ON public.ai_models
  FOR SELECT USING (auth.role() = 'authenticated' AND is_enabled = true);

CREATE POLICY "ai_models_admin" ON public.ai_models
  FOR ALL USING (public.is_admin());
