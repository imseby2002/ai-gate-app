-- =============================================
-- AI GATE - Functions & Triggers
-- Migration 003
-- =============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER assistants_updated_at BEFORE UPDATE ON public.assistants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Aggregate usage on message insert
CREATE OR REPLACE FUNCTION public.aggregate_usage_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'assistant' AND NEW.model_id IS NOT NULL THEN
    INSERT INTO public.usage_daily
      (user_id, model_id, date, message_count, input_tokens, output_tokens, total_cost_usd)
    VALUES
      (NEW.user_id, NEW.model_id, CURRENT_DATE, 1,
       COALESCE(NEW.input_tokens, 0),
       COALESCE(NEW.output_tokens, 0),
       COALESCE(NEW.cost_usd, 0))
    ON CONFLICT (user_id, model_id, date)
    DO UPDATE SET
      message_count  = usage_daily.message_count + 1,
      input_tokens   = usage_daily.input_tokens + EXCLUDED.input_tokens,
      output_tokens  = usage_daily.output_tokens + EXCLUDED.output_tokens,
      total_cost_usd = usage_daily.total_cost_usd + EXCLUDED.total_cost_usd;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_insert_aggregate
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_usage_on_message();

-- Get user credit balance function
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS NUMERIC LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(SUM(amount_usd), 0)
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
$$;

-- Get usage summary for a user
CREATE OR REPLACE FUNCTION public.get_usage_summary(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  model_id TEXT,
  display_name TEXT,
  message_count BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_cost_usd NUMERIC
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    ud.model_id,
    m.display_name,
    SUM(ud.message_count)::BIGINT,
    SUM(ud.input_tokens)::BIGINT,
    SUM(ud.output_tokens)::BIGINT,
    SUM(ud.total_cost_usd)
  FROM public.usage_daily ud
  JOIN public.ai_models m ON m.id = ud.model_id
  WHERE ud.user_id = p_user_id
    AND ud.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY ud.model_id, m.display_name
  ORDER BY SUM(ud.total_cost_usd) DESC;
$$;
