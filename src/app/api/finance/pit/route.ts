import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { normalizeSettings, DEFAULT_PIT_SETTINGS, PIT_SOURCES } from '@/lib/acc/pit'

// 會計・個人稅：稅籍總覽（員工 MST、扶養人、稅率設定）
const deny = (status: number) => NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

export async function GET() {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const { admin, ownerId } = ctx

  const [emp, dep, set] = await Promise.all([
    admin.from('hr_employees')
      .select('id, name, attendance_no, store, position, staff_category, status, tax_code, id_number, pit_method, insurance_status, insurance_salary')
      .eq('owner_id', ownerId).order('store').order('name'),
    admin.from('hr_tax_dependents').select('*').eq('owner_id', ownerId).order('created_at'),
    admin.from('acc_pit_settings').select('*').eq('owner_id', ownerId).maybeSingle(),
  ])
  const err = emp.error ?? dep.error ?? set.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  return NextResponse.json({
    employees: emp.data ?? [],
    dependents: dep.data ?? [],
    settings: normalizeSettings(set.data),
    sources: PIT_SOURCES,
  })
}

// 更新稅率設定
export async function PUT(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const body = await req.json().catch(() => ({}))
  const s = normalizeSettings({ ...DEFAULT_PIT_SETTINGS, ...body })
  const { error } = await ctx.admin.from('acc_pit_settings')
    .upsert({ owner_id: ctx.ownerId, ...s, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: s })
}

// 更新員工稅籍（MST、計稅方式）
export async function PATCH(req: NextRequest) {
  const ctx = await getUnitContextAny(['finance', 'hr'])
  if (!ctx.ok) return deny(ctx.status)
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.tax_code === 'string') updates.tax_code = body.tax_code.trim()
  if (['', 'progressive', 'flat10', 'none'].includes(body.pit_method)) updates.pit_method = body.pit_method
  const { data, error } = await ctx.admin.from('hr_employees').update(updates)
    .eq('id', id).eq('owner_id', ctx.ownerId).select('id, tax_code, pit_method').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}
