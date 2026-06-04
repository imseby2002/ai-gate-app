// GET /api/skills — 列出可用 skill（含表單欄位與計價），並回傳目前餘額
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listSkills } from '@/lib/skills/registry'
import { getBalance } from '@/lib/skills/billing'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const balance = await getBalance(user.id)
  return NextResponse.json({ skills: listSkills(), balance })
}
