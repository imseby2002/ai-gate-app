import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getStoreUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getStoreUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { store, period_id, rows } = (await req.json()) as {
    store?: string
    period_id?: string
    rows?: Record<string, unknown>[]
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的排班資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  // 1) 查詢員工對照
  const { data: emps } = await supabase
    .from('hr_employees')
    .select('id, name, attendance_no')
    .eq('owner_id', user.id)

  const empMap = new Map((emps || []).map(e => [e.name.trim().toLowerCase(), e.id]))

  // 2) 如果有指定 period_id，取得該排班期的 slots
  let activePeriodId = period_id
  let slots = [{ code: 's0', label: '早' }, { code: 's1', label: '午' }, { code: 's2', label: '晚' }]

  if (activePeriodId) {
    const { data: p } = await supabase
      .from('shift_periods')
      .select('id, slots')
      .eq('id', activePeriodId)
      .single()
    if (p && Array.isArray(p.slots)) {
      slots = p.slots as { code: string; label: string }[]
    }
  } else if (store) {
    // 找該門市最近的排班期
    const { data: p } = await supabase
      .from('shift_periods')
      .select('id, slots')
      .eq('owner_id', user.id)
      .eq('store', store)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (p) {
      activePeriodId = p.id
      if (Array.isArray(p.slots)) slots = p.slots as { code: string; label: string }[]
    }
  }

  if (!activePeriodId) {
    return NextResponse.json({ error: '請先選擇或建立排班期後再匯入排班資料' }, { status: 400 })
  }

  const slotMap = new Map<string, string>()
  slots.forEach(s => {
    slotMap.set(s.code.toLowerCase(), s.code)
    slotMap.set(s.label.toLowerCase(), s.code)
  })

  const toUpsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.employee_name ?? r.name ?? '').trim()
    const workDate = String(r.work_date ?? r.date ?? '').trim()
    const slotInput = String(r.slot_code ?? r.slot ?? r.shift ?? '早').trim().toLowerCase()

    if (!name) {
      errors.push({ line, reason: '缺少員工姓名' })
      continue
    }
    if (!workDate) {
      errors.push({ line, reason: '缺少工作日期 (YYYY-MM-DD)' })
      continue
    }

    const empId = empMap.get(name.toLowerCase())
    if (!empId) {
      errors.push({ line, reason: `找不到員工「${name}」` })
      continue
    }

    const slotCode = slotMap.get(slotInput) || slots[0]?.code || 's0'

    toUpsert.push({
      owner_id: user.id,
      period_id: activePeriodId,
      employee_id: empId,
      work_date: workDate,
      slot_code: slotCode,
    })
  }

  let inserted = 0
  if (toUpsert.length > 0) {
    const { data, error } = await supabase
      .from('shift_assignments')
      .upsert(toUpsert, { onConflict: 'period_id,employee_id,work_date,slot_code' })
      .select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ ok: true, inserted, errors })
}
