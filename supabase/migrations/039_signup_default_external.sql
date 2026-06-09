-- 新用戶預設身分改為 external（原為 employee）。
-- 一般註冊會在 metadata 帶 user_type；但 Google OAuth 等註冊通常不帶，
-- 過去會落為 employee 而被隱藏「求職階段」。改為 external 較符合預期，
-- 真正員工仍透過「後台改帳號」或「白名單邀請（註冊時選員工）」明確設為 employee。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'external')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
