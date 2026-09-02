import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let q = supabase.from('hr_attendance').select('*').eq('owner_id', user.id)
  if (year) q = q.eq('year', parseInt(year))
  if (month) q = q.eq('month', parseInt(month))
  const { data, error } = await q.order('store', { ascending: true }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data ?? [] })
}

// 編輯手動補登（adjust_hours / adjust_note）並強制記錄 Audit Log
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { id, adjust_hours, adjust_note, adjusted_by } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (adjust_hours !== undefined && adjust_hours !== 0 && !String(adjust_note || '').trim()) {
    return NextResponse.json({ error: '手動修改工時必須填寫調整原因（如：忘記打卡、外出外送、設備故障）' }, { status: 400 })
  }

  // 先取出既有 audit_log
  const { data: current } = await supabase
    .from('hr_attendance')
    .select('audit_log, adjust_hours')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  const logList = Array.isArray(current?.audit_log) ? current.audit_log : []
  if (adjust_hours !== undefined) {
    logList.push({
      old_hours: current?.adjust_hours ?? 0,
      new_hours: Number(adjust_hours),
      reason: String(adjust_note || '').trim(),
      adjusted_by: String(adjusted_by || 'HR Admin').trim(),
      timestamp: new Date().toISOString(),
    })
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    audit_log: logList,
  }
  if (adjust_hours !== undefined) patch.adjust_hours = Number(adjust_hours) || 0
  if (adjust_note !== undefined) patch.adjust_note = String(adjust_note ?? '').trim()

  const { data, error } = await supabase
    .from('hr_attendance')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attendance: data })
}
