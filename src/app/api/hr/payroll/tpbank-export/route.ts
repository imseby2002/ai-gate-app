import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { buildXlsx, vnUpperAscii, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 產出 TPBank 企業網銀薪資檔 (Chuyển tiền chi lương - Tải lên tệp)
// 官方標準欄位：STT, Số tài khoản, Tên người thụ hưởng, Số tiền, Nội dung chuyển tiền
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(sp.get('month') ?? '') || (new Date().getMonth() + 1)
  const store = sp.get('store') ?? ''

  // 讀取該月份薪資與員工資料
  let q = supabase
    .from('hr_payroll')
    .select(`
      id, year, month, net_pay, base_salary, allowances, bonus, deductions, notes,
      employee_id,
      hr_employees (
        id, name, bank_account, bank_name, store, position, department
      )
    `)
    .eq('owner_id', user.id)
    .eq('year', year)
    .eq('month', month)

  const { data: list, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = (list ?? []).filter(item => {
    const emp = item.hr_employees as any
    if (!emp) return false
    if (store && emp.store !== store) return false
    return Number(item.net_pay) > 0
  })

  // 格式建構
  const header: XlsxCell[] = [
    'STT',
    'Số tài khoản nhận',
    'Tên người thụ hưởng',
    'Số tiền (VND)',
    'Nội dung chuyển tiền',
    'Ngân hàng nhận',
    'Cửa hàng/Bộ phận',
  ]

  const rows: XlsxCell[][] = [header]
  filtered.forEach((item, idx) => {
    const emp = item.hr_employees as any
    const net = Math.round(Number(item.net_pay) || 0)
    const acc = String(emp?.bank_account ?? '').trim()
    const name = vnUpperAscii(emp?.name ?? '')
    const remark = `Luong T${month}/${year} - ${name}`.slice(0, 50)
    const bank = emp?.bank_name || 'TPBank'
    const dept = emp?.store || emp?.department || ''

    rows.push([
      idx + 1,
      acc,
      name,
      net,
      remark,
      bank,
      dept,
    ])
  })

  const buf = buildXlsx('ChiLuongTPBank', rows)
  const filename = `TPBank_Salary_T${month}_${year}.xlsx`

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
