import { getUnitContext } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'

// 派工對象：外部廠商（fin_vendors）＋內部員工（hr_employees），限維修單位
export async function GET() {
  const c = await getUnitContext('repair')
  if (!c.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [v, e] = await Promise.all([
    c.admin.from('fin_vendors').select('id, name, service').eq('owner_id', c.ownerId).eq('active', true).order('name'),
    c.admin.from('hr_employees').select('id, name, store, status').eq('owner_id', c.ownerId).order('store'),
  ])

  const vendors = (v.data ?? []).map(r => ({ id: r.id, name: r.name, service: r.service ?? '' }))
  // 排除已離職員工
  const employees = (e.data ?? [])
    .filter(r => !['resigned', 'terminated', 'inactive', '離職'].includes(String(r.status ?? '')))
    .map(r => ({ id: r.id, name: r.name, store: r.store ?? '' }))

  return NextResponse.json({ vendors, employees })
}
