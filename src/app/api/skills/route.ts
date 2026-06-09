// GET /api/skills — 列出可用 skill（含表單欄位與計價），並回傳目前餘額
// ?module=marketing|chat 可分流（行銷中心專家模式 / 思維決策）
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listSkills } from '@/lib/skills/registry'
import { getBalance } from '@/lib/skills/billing'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const module = req.nextUrl.searchParams.get('module') ?? undefined
  const balance = await getBalance(user.id)
  return NextResponse.json({ skills: listSkills(module), balance })
}
