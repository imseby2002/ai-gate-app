export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMarketForUser } from '@/lib/booking/market-run'

// 手動立即執行市場跟隨：只針對當前登入用戶，抓行情+依 market 規則寫入每日定價。
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const result = await runMarketForUser(admin, user.id)

  if (result.location === null)
    return NextResponse.json({ error: '尚未填寫民宿所在地（縣市／地址），無法查行情' }, { status: 400 })

  return NextResponse.json(result)
}
