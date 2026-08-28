import { NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { buildXlsx, vnUpperAscii, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const STAFF_LABEL: Record<string, string> = { fulltime: '正職', hourly: '工讀' }
const INS_STATUS_LABEL: Record<string, string> = { none: '不需投保', pending: '待投保', enrolled: '已投保' }

// 保險申請名單匯出（通用格式；待拿到真正申請單範本後再逐格對齊）
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('hr_employees')
    .select('name, id_number, insurance_number, insurance_salary, insurance_status, staff_category, department, position, store, hire_date')
    .eq('owner_id', user.id).eq('insurance_required', true)
    .order('store', { ascending: true }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const header: XlsxCell[] = [
    '序號', '姓名', '姓名(無聲調)', '身分證字號', '保險編號', '投保薪資',
    '類別', '部門', '職稱', '門市', '到職日', '保險狀態',
  ]
  const rows: XlsxCell[][] = [header]
  ;(data ?? []).forEach((e, i) => {
    const emp = e as {
      name: string; id_number: string; insurance_number: string; insurance_salary: number
      insurance_status: string; staff_category: string; department: string; position: string
      store: string; hire_date: string | null
    }
    rows.push([
      i + 1,
      emp.name,
      vnUpperAscii(emp.name),
      emp.id_number ?? '',
      emp.insurance_number ?? '',
      Math.round(Number(emp.insurance_salary) || 0),
      STAFF_LABEL[emp.staff_category] ?? emp.staff_category,
      emp.department ?? '',
      emp.position ?? '',
      emp.store ?? '',
      emp.hire_date ?? '',
      INS_STATUS_LABEL[emp.insurance_status] ?? emp.insurance_status,
    ])
  })

  const buf = buildXlsx('BaoHiem', rows)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="insurance_application_${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
