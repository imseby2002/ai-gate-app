import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements } from '@/lib/module-plans/entitlements'
import { isPlanModule } from '@/lib/module-plans/definitions'

// GET /api/module-plans/me?module=legal → 目前帳號在該模組的方案與功能（前端顯示鎖定狀態用）。
// JSON 無法表示 Infinity，數值上限為 Infinity 時回傳 null（= 不限）。
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const moduleId = req.nextUrl.searchParams.get('module') ?? ''
  if (!isPlanModule(moduleId)) return NextResponse.json({ error: '無效的模組' }, { status: 400 })

  const { plan, features } = await getModuleEntitlements(user.id, moduleId)
  return NextResponse.json({ plan, features })
}
