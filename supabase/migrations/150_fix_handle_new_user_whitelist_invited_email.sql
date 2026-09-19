-- =============================================
-- AI GATE - Migration 150
-- 修復 handle_new_user() 員工白名單自動綁定 company_members 遺漏 invited_email 的問題
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_type TEXT;
  v_in_whitelist BOOLEAN;
  v_company_id UUID;
BEGIN
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'external');

  SELECT true, company_id
  INTO v_in_whitelist, v_company_id
  FROM public.employee_whitelist
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  v_in_whitelist := COALESCE(v_in_whitelist, false);

  IF v_in_whitelist THEN
    v_user_type := 'employee';
  ELSIF v_user_type = 'employee' THEN
    v_user_type := 'external';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, user_type, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url',
    v_user_type,
    v_company_id
  )
  ON CONFLICT (id) DO UPDATE SET
    company_id = COALESCE(profiles.company_id, EXCLUDED.company_id),
    user_type = CASE WHEN EXCLUDED.user_type = 'employee' THEN 'employee' ELSE profiles.user_type END;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, member_id, invited_email, role, status, accepted_at)
    VALUES (v_company_id, NEW.id, LOWER(NEW.email), 'viewer', 'active', now())
    ON CONFLICT (company_id, invited_email) DO UPDATE SET
      member_id = EXCLUDED.member_id,
      status = 'active',
      accepted_at = now();
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
