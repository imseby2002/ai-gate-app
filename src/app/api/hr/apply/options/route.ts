import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFICE_VALUE, type UnitOption } from '@/lib/hr/apply-units'
import { getFeelingTeaStoreName } from '@/lib/constants/feeling-tea-stores'

// 公開應徵表單的單位選項：門市、辦公室、工廠。?code=<應徵代碼> 或 ?token=<應徵者連結>
export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const sp = req.nextUrl.searchParams
  const code = (sp.get('code') ?? '').trim(), token = (sp.get('token') ?? '').trim()
  let ownerId: string | null = null
  if (code) {
    const { data } = await admin.from('hr_settings').select('owner_id').eq('apply_code', code).maybeSingle()
    ownerId = data?.owner_id ?? null
  } else if (token) {
    const { data } = await admin.from('agent_hr_candidates').select('user_id').eq('apply_token', token).maybeSingle()
    ownerId = data?.user_id ?? null
  }
  if (!ownerId) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: rows } = await admin.from('fin_stores').select('code, name, unit_type, active').eq('owner_id', ownerId).order('code')
  const active = (rows ?? []).filter(r => r.code && r.active !== false)
  const opt = (r: { code: string; name: string | null }, kind: UnitOption['kind']): UnitOption => {
    const c = String(r.code).trim(), n = String(r.name ?? '').trim()
    const cleanName = getFeelingTeaStoreName(n || c)
    return { kind, value: c, name: cleanName || n || c }
  }
  const stores = active.filter(r => (r.unit_type ?? 'store') === 'store').map(r => opt(r, 'store'))
  const factories = active.filter(r => r.unit_type === 'factory').map(r => opt(r, 'factory'))
  const units: UnitOption[] = [
    ...stores,
    { kind: 'office', value: OFFICE_VALUE, name: OFFICE_VALUE },
    ...(factories.length ? factories : [{ kind: 'factory' as const, value: '工廠', name: '工廠' }]),
  ]
  return NextResponse.json({ units }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
