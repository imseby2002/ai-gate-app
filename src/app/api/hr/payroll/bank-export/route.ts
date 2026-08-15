import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildXlsx, vnUpperAscii, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const SHEET = 'TPBBiz_Chuyen_Tien_Chi_Luong'
const DEFAULT_BANK = 'TPB-TPBank-Ngan hang TMCP Tien Phong'
const DEFAULT_CODE = '01358001'

// TPBank 範本標題列（逐格對照真實範本）
const HEADER: XlsxCell[] = [
  'STT\n(Ord.No)\n(tối đa 5000 giao dịch)',
  'Số tài khoản (Beneficiary\'s account)\nDãy số liền không phân cách (Number without space)',
  'Tên tài khoản nhận (Beneficiary)\nDùng chữ không dấu. \nTránh các ký tự đặc biệt như #$%^ (Avoid accented, special letters:#$%^) \n',
  'Số tiền \n(Amount)\n',
  'Nội dung\n(Contents)\nDùng chữ không dấu. Tránh các ký tự đặc biệt như #$%^ (Avoid accented, special letters:#$%^) ',
  'Ngân hàng nhận\n(Beneficiary\'s bank)\nBạn hãy click vào ô dưới và chọn ngân hàng trong danh sách\n(Click on the box below and select the bank in the list)',
  '',
  'Mã Ngân hàng - \nBạn Không điền vào cột này \n(Bankcode -\n Please don\'t input)\nNếu không có mã Citad phải chọn lại ngân hàng\n(Reselect Bank if null)',
]

type Emp = { name: string; bank_account: string; bank_name: string }
type PayRow = {
  base_salary: number; allowances: number; deductions: number; bonus: number; net_pay: number | null
  hr_employees: Emp | Emp[] | null
}
const oneEmp = (e: PayRow['hr_employees']): Emp | null => (Array.isArray(e) ? (e[0] ?? null) : e)

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? '') || new Date().getFullYear()
  const month = parseInt(searchParams.get('month') ?? '') || (new Date().getMonth() + 1)

  const { data, error } = await supabase
    .from('hr_payroll')
    .select('base_salary, allowances, deductions, bonus, net_pay, hr_employees(name, bank_account, bank_name)')
    .eq('owner_id', user.id).eq('year', year).eq('month', month)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const content = `tra luong thang ${month}`
  const dataRows: XlsxCell[][] = []
  let stt = 0, total = 0
  for (const p of (data ?? []) as unknown as PayRow[]) {
    const emp = oneEmp(p.hr_employees)
    if (!emp) continue
    const account = (emp.bank_account ?? '').replace(/\s/g, '')
    const amount = Math.round(Number(p.net_pay ?? (p.base_salary + p.allowances + p.bonus - p.deductions)) || 0)
    if (!account || amount <= 0) continue // 無帳號或無金額者略過
    const bank = emp.bank_name?.trim() || DEFAULT_BANK
    const code = (!emp.bank_name?.trim() || bank === DEFAULT_BANK) ? DEFAULT_CODE : ''
    stt++; total += amount
    dataRows.push([stt, account, vnUpperAscii(emp.name), amount, content, bank, '', code])
  }

  const rows: XlsxCell[][] = [
    ['', '', 'Tổng số tiền (Total)', total, 'Tổng lệnh (Total order)', stt],
    HEADER,
    ...dataRows,
  ]

  const buf = buildXlsx(SHEET, rows)
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="TPBank_salary_${year}_${String(month).padStart(2, '0')}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
