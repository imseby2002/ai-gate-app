import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sanitizeSlots } from '@/lib/shift/util'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const dateOrNull = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }

// 某門市的排班期清單。?store= 必填
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const store = s(new URL(req.url).searchParams.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const { data, error } = await supabase.from('shift_periods')
    .select('id, title, start_date, end_date, slots, status, created_at')
    .eq('owner_id', user.id).eq('store', store).order('start_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ periods: data ?? [] })
}

// 建立排班期，並為該門市在職員工各產生一組填報連結。
// body: { store, title?, start_date, end_date, slots? }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  const start_date = dateOrNull(b.start_date)
  const end_date = dateOrNull(b.end_date)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  if (!start_date || !end_date) return NextResponse.json({ error: '起訖日期必填（YYYY-MM-DD）' }, { status: 400 })
  if (end_date < start_date) return NextResponse.json({ error: '結束日不可早於起始日' }, { status: 400 })

  const slots = sanitizeSlots(b.slots)
  const { data: period, error } = await supabase.from('shift_periods').insert({
    owner_id: user.id, store, title: s(b.title), start_date, end_date, slots, status: 'collecting',
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 帶入該門市在職員工，各給一組 token
  const { data: emps } = await supabase.from('hr_employees')
    .select('id, name').eq('owner_id', user.id).eq('store', store).eq('status', 'active')
  const rows = (emps ?? []).map(e => ({
    owner_id: user.id, period_id: period.id, employee_id: e.id, employee_name: e.name ?? '',
    token: randomBytes(18).toString('base64url'),
  }))
  if (rows.length > 0) {
    const { error: tErr } = await supabase.from('shift_tokens').insert(rows)
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  }
  return NextResponse.json({ id: period.id, employees: rows.length })
}

// 刪除排班期（連同 token 與可上班紀錄，FK on delete cascade）。body: { id }
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('shift_periods').delete().eq('id', s(id)).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
