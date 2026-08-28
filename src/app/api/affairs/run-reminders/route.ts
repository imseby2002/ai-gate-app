import { NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { runAffairReminders } from '@/lib/affairs/reminders'

// 後台「立即檢查提醒」：僅處理該公司 owner 的文件（沿用去重，不會重複發送）。
export async function POST() {
  const ctx = await getUnitContext('affairs')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runAffairReminders(ctx.admin, ctx.ownerId)
  return NextResponse.json({ ok: true, ...result })
}
