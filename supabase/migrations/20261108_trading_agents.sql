-- ==============================================================================
-- TradingAgents: Multi-Agent Financial Trading Framework Persistence
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.trading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  market_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  portfolio_context JSONB DEFAULT NULL,
  valuation_suite JSONB DEFAULT NULL,
  analysts JSONB NOT NULL DEFAULT '{}'::jsonb,
  debate JSONB NOT NULL DEFAULT '{}'::jsonb,
  trader_proposal JSONB DEFAULT NULL,
  risk_assessment JSONB DEFAULT NULL,
  final_decision JSONB DEFAULT NULL,
  full_report_html TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  settlement JSONB DEFAULT NULL, -- Stores backtest/settlement reflection: { settled_price, return_pct, reflection, settled_at }
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_id ON public.trading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_ticker ON public.trading_sessions(ticker);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_created_at ON public.trading_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trading sessions"
  ON public.trading_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trading sessions"
  ON public.trading_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trading sessions"
  ON public.trading_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trading sessions"
  ON public.trading_sessions
  FOR DELETE
  USING (auth.uid() = user_id);
