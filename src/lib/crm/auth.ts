import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 客戶系統 API 共用身分驗證：未登入 401、停用 403 */
export async function getCrmUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '未登入' }, { status: 401 }) } as const
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profile?.is_active === false) {
    return { error: NextResponse.json({ error: '帳號已停用' }, { status: 403 }) } as const
  }
  return { supabase, user, isAdmin: profile?.user_type === 'admin' } as const
}
