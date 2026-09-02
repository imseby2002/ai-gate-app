import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { buildXlsx, vnUpperAscii, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const STAFF_LABEL: Record<string, string> = { fulltime: '正職', hourly: '兼職工讀' }
const INS_STATUS_LABEL: Record<string, string> = { none: '未投保', pending: '待申報加保', enrolled: '已投保' }

// 支援多種越南官方社保申報格式：
// 1. mode=general: 內部投保檢核總表
// 2. mode=d02lt: 對接 VNPT/Viettel-BHXH 之 Mẫu D02-LT (新增/調級/退保)
// 3. mode=tk1ts: Mẫu TK1-TS (無舊社保編號之首度參保申報清冊)
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const mode = sp.get('mode') || 'd02lt'

  const { data, error } = await supabase
    .from('hr_employees')
    .select('name, id_number, insurance_number, insurance_salary, insurance_status, staff_category, department, position, store, hire_date, phone, email, notes')
    .eq('owner_id', user.id)
    .order('store', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = (data ?? []) as any[]
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  if (mode === 'tk1ts') {
    // ── Mẫu TK1-TS：首度參保無社保編號者 ──
    const needTk1 = list.filter(e => !e.insurance_number || e.insurance_status === 'pending')
    const header: XlsxCell[] = [
      'STT', 'Họ và tên', 'Họ tên không dấu', 'Số CCCD/Định danh',
      'Điện thoại liên hệ', 'Chức danh', 'Bộ phận/Cửa hàng', 'Ngày vào làm', 'Ghi chú (TK1-TS)',
    ]
    const rows: XlsxCell[][] = [
      ['DANH SÁCH THAM GIA BHXH LẦN ĐẦU (MẪU TK1-TS / VssID)', '', '', '', '', '', '', '', ''],
      header,
    ]
    needTk1.forEach((emp, i) => {
      rows.push([
        i + 1,
        emp.name,
        vnUpperAscii(emp.name),
        emp.id_number || '',
        emp.phone || '',
        emp.position || '',
        emp.store || emp.department || '',
        emp.hire_date || '',
        'Chưa có sổ BHXH, đề nghị cấp mới',
      ])
    })

    const buf = buildXlsx('Mau_TK1_TS', rows)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Mau_TK1_TS_${today}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ── Mẫu D02-LT：VNPT-BHXH / Viettel-BHXH 申報清冊 ──
  // 分為：I. Tăng mới (新增投保), II. Điều chỉnh mức đóng (調整級距), III. Giảm (退保)
  const rows: XlsxCell[][] = [
    ['BẢNG KÊ KHAI LAO ĐỘNG THAM GIA BHXH, BHYT, BHTN (MẪU D02-LT)', '', '', '', '', '', '', '', '', ''],
    ['Đơn vị: CÔNG TY TNHH IM-TOURIST', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    [
      'STT', 'Họ và tên người lao động', 'Họ tên không dấu', 'Mã số BHXH', 'Số CCCD',
      'Chức vụ / Chức danh', 'Mức tiền lương đóng BHXH', 'Từ tháng/năm', 'Phân loại (Tăng/Giảm/Điều chỉnh)', 'Cửa hàng',
    ],
  ]

  let stt = 1
  list.forEach(emp => {
    const isEnrolled = emp.insurance_status === 'enrolled'
    const isPending = emp.insurance_status === 'pending'
    const cat = isPending ? 'I. Tăng mới (新增投保)' : isEnrolled ? 'II. Duy trì / Điều chỉnh (在保/調整)' : 'III. Chưa tham gia (未投保)'

    rows.push([
      stt++,
      emp.name,
      vnUpperAscii(emp.name),
      emp.insurance_number || '(Chưa có - Cấp mới)',
      emp.id_number || '',
      emp.position || emp.department || 'Nhân viên',
      Math.round(Number(emp.insurance_salary) || 5000000),
      emp.hire_date ? emp.hire_date.slice(0, 7) : '',
      cat,
      emp.store || '',
    ])
  })

  const buf = buildXlsx('Mau_D02_LT', rows)
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Mau_D02_LT_${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
