-- =============================================
-- AI GATE - Migration 135
-- 員工白名單擴充所屬公司 (company_id) 與公司自主新增權限
-- =============================================

-- 1. 擴充 employee_whitelist 欄位
ALTER TABLE public.employee_whitelist
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employee_whitelist_company_id
  ON public.employee_whitelist(company_id);

-- 2. 開放公司擁有者與管理員存取自己公司的白名單
CREATE POLICY "Company owners and admins can manage company whitelist"
  ON public.employee_whitelist
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = employee_whitelist.company_id
        AND cm.member_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = employee_whitelist.company_id
        AND cm.member_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
  );

-- 3. 更新 handle_new_user 註冊觸發器，自動綁定 company_id 與 company_members
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_type TEXT;
  v_in_whitelist BOOLEAN;
  v_company_id UUID;
BEGIN
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'external');

  SELECT EXISTS(
    SELECT 1 FROM public.employee_whitelist
    WHERE LOWER(email) = LOWER(NEW.email)
  ), company_id INTO v_in_whitelist, v_company_id
  FROM public.employee_whitelist
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

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
    INSERT INTO public.company_members (company_id, member_id, role, status)
    VALUES (v_company_id, NEW.id, 'viewer', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
