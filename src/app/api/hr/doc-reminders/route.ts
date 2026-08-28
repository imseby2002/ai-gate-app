import { NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { runDocReminders } from '@/lib/hr/doc-reminders'

// 後台「立即寄缺件提醒」：處理公司人員（沿用週節流，不會重複轟炸）。
export async function POST() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await runDocReminders(ctx.admin, ctx.ownerId)
  return NextResponse.json({ ok: true, ...result })
}
