import { getUnitContext } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'
import { runExpiryReminders } from '@/lib/inv/expiry'

// 後台「立即檢查到期」：僅處理該公司 owner 的批次（沿用去重升級，不會重複發送）。
export async function POST() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await runExpiryReminders(ctx.admin, ctx.ownerId)
  return NextResponse.json({ ok: true, ...result })
}
