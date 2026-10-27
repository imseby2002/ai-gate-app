import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { generatePayrollDraft } from '@/lib/hr/payroll-draft'

export const maxDuration = 60

// 自動產生某月薪資草稿。body: { year, month, overwriteAuto? }
export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const year = Number(b.year), month = Number(b.month)
  if (!year || year < 2000 || year > 2100 || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: '年月無效' }, { status: 400 })
  }
  try {
    const result = await generatePayrollDraft(ctx.admin, ctx.ownerId, year, month, !!b.overwriteAuto)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
