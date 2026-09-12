-- 151_mobile_push_tokens.sql
-- 行動端推播 Token 與設備管理

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token_updated_at timestamptz;

-- 支援多裝置登入推播表
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  push_token text NOT NULL,
  device_os text,
  device_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, push_token)
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
