import { NextRequest, NextResponse } from 'next/server'
import { getUnitContextAny } from '@/lib/auth/unit-access'

async function getFinanceOrStoreUser() {
  const ctx = await getUnitContextAny(['finance', 'store'])
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getFinanceOrStoreUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: existing } = await supabase
    .from('fin_stores')
    .select('id, code, name')
    .eq('owner_id', user.id)

  const existingList = existing || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const code = String(r.code ?? '').trim().toUpperCase()
    const name = String(r.name ?? code).trim()

    if (!code) {
      errors.push({ line, reason: '缺少編碼 (code)' })
      continue
    }

    let active = r.active
    if (typeof active === 'string') {
      active = !['false', '0', '否', 'no', '停用', 'inactive'].includes(active.trim().toLowerCase())
    } else if (active === undefined || active === null || active === '') {
      active = true
    }

    const payload: Record<string, unknown> = {
      code,
      name: name || code,
      region: String(r.region ?? '').trim(),
      active: !!active,
      unit_type: String(r.unit_type ?? 'store').trim() || 'store',
      short_name: String(r.short_name ?? '').trim(),
      electricity_no: String(r.electricity_no ?? '').trim(),
      water_no: String(r.water_no ?? '').trim(),
      address: String(r.address ?? '').trim(),
      base_hourly_rate: Number(r.base_hourly_rate) || 0,
      updated_at: new Date().toISOString(),
    }

    const match = existingList.find(s => s.code.trim().toUpperCase() === code)
    if (match) {
      const { error } = await supabase
        .from('fin_stores')
        .update(payload)
        .eq('id', match.id)
      if (error) {
        errors.push({ line, reason: `更新門市「${code}」失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      payload.owner_id = user.id
      const { error } = await supabase
        .from('fin_stores')
        .insert(payload)
      if (error) {
        errors.push({ line, reason: `新增門市「${code}」失敗: ${error.message}` })
      } else {
        inserted++
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
