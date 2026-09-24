import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

// 回傳「目前操作中的客服業務」owner id，跟 /api/marketing/campaign 等其他 CS 路由
// 解析 ownerId 的方式一致。CsWorkspace 的 webhook 網址要指向這個 id（資料實際擁有者），
// 不能用 /api/auth/me 的登入者本人 id——切換公司身分後兩者會不一樣。
export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ id: ctx.ownerId })
}
