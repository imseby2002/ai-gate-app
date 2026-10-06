import { NextRequest, NextResponse } from 'next/server'
import { hashPin } from '@/lib/hr/portal'
import { portalEmployee } from '../_auth'

// POST { pin }：設定／變更自己的密碼（至少 6 碼）
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { pin } = await req.json().catch(() => ({}))
  const p = String(pin ?? '').trim()
  if (p.length < 6) return NextResponse.json({ error: 'Mật khẩu ít nhất 6 ký tự / 密碼至少 6 碼' }, { status: 400 })
  const { error } = await ctx.admin.from('hr_employee_portal').upsert({
    employee_id: ctx.emp.id, pin_hash: hashPin(p), failed_count: 0, locked_until: null, updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
