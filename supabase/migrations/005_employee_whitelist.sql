-- =============================================
-- AI GATE - Employee Email Whitelist
-- Migration 005
-- =============================================

-- Create employee_whitelist table
CREATE TABLE IF NOT EXISTS public.employee_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  note TEXT,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT employee_whitelist_email_unique UNIQUE (email)
);

ALTER TABLE public.employee_whitelist ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write whitelist
CREATE POLICY "Admin full access to whitelist" ON public.employee_whitelist
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Update handle_new_user to enforce whitelist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_type TEXT;
  v_in_whitelist BOOLEAN;
BEGIN
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'external');

  -- If registering as employee, verify email is in whitelist
  IF v_user_type = 'employee' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.employee_whitelist
      WHERE LOWER(email) = LOWER(NEW.email)
    ) INTO v_in_whitelist;

    IF NOT v_in_whitelist THEN
      v_user_type := 'external';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url',
    v_user_type
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
