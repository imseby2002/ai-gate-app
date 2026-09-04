import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 匯出符合越南總工會（Tổng Liên đoàn Lao động Việt Nam）標準之 Mẫu B14-CĐ & B15-CĐ 報表
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const sp = new URL(req.url).searchParams
  const year = parseInt(sp.get('year') ?? '') || new Date().getFullYear()

  // 讀取當年度工會財務記錄
  const { data: records } = await supabase
    .from('hr_union_finances')
    .select('*')
    .eq('owner_id', user.id)
    .gte('trans_date', `${year}-01-01`)
    .lte('trans_date', `${year}-12-31`)
    .order('trans_date', { ascending: true })

  const list = records ?? []

  // 統計收支項目
  let thuDoanPhi = 0 // 1% Đoàn phí
  let thuKinhPhi = 0 // 2% Kinh phí công đoàn
  let thuKhac = 0
  let chiHoatDong = 0 // Hoạt động phong trào
  let chiThamHoi = 0 // Thăm hỏi, trợ cấp
  let chiQuanLy = 0 // Chi quản lý hành chính
  let chiKhac = 0

  for (const r of list) {
    const amt = Number(r.amount) || 0
    if (r.type === 'income') {
      if (r.category === 'union_dues') thuDoanPhi += amt
      else if (r.category === 'employer_contrib') thuKinhPhi += amt
      else thuKhac += amt
    } else {
      if (r.category === 'welfare') chiThamHoi += amt
      else if (r.category === 'activity') chiHoatDong += amt
      else if (r.category === 'admin') chiQuanLy += amt
      else chiKhac += amt
    }
  }

  const tongThu = thuDoanPhi + thuKinhPhi + thuKhac
  const tongChi = chiHoatDong + chiThamHoi + chiQuanLy + chiKhac

  // 建立符合 Tổng Liên đoàn Lao động Việt Nam 規範之 Mẫu B14-CĐ
  const rows: XlsxCell[][] = [
    ['TỔNG LIÊN ĐOÀN LAO ĐỘNG VIỆT NAM', '', '', 'MẪU B14-CĐ'],
    ['CÔNG ĐOÀN CƠ SỞ CÔNG TY IM-TOURIST', '', '', '(Ban hành theo Quyết định của TLĐ)'],
    ['', '', '', ''],
    ['BÁO CÁO QUYẾT TOÁN THU - CHI TÀI CHÍNH CÔNG ĐOÀN', '', '', ''],
    [`Năm tài chính: ${year}`, '', '', 'Đơn vị tính: VNĐ'],
    ['', '', '', ''],
    ['Mã số', 'Nội dung thu / chi', 'Dự toán năm', 'Thực hiện quyết toán'],
    ['A', 'PHẦN THU (收入部分)', '', ''],
    ['01', '1. Thu kinh phí công đoàn (2% Doanh nghiệp đóng)', '', Math.round(thuKinhPhi)],
    ['02', '2. Thu đoàn phí công đoàn (1% Đoàn viên đóng)', '', Math.round(thuDoanPhi)],
    ['03', '3. Các khoản thu khác', '', Math.round(thuKhac)],
    ['10', 'TỔNG CỘNG THU (01 + 02 + 03)', '', Math.round(tongThu)],
    ['', '', '', ''],
    ['B', 'PHẦN CHI (支出部分)', '', ''],
    ['20', '1. Chi thăm hỏi, trợ cấp đoàn viên, người lao động (福利慰問)', '', Math.round(chiThamHoi)],
    ['21', '2. Chi hoạt động phong trào, tuyên truyền (活動推廣)', '', Math.round(chiHoatDong)],
    ['22', '3. Chi quản lý hành chính công đoàn (行政管理)', '', Math.round(chiQuanLy)],
    ['23', '4. Các khoản chi hợp pháp khác', '', Math.round(chiKhac)],
    ['30', 'TỔNG CỘNG CHI (20 + 21 + 22 + 23)', '', Math.round(tongChi)],
    ['', '', '', ''],
    ['40', 'CHÊNH LỆCH THU TRỪ CHI (KẾT DƯ / THÂM HỤT)', '', Math.round(tongThu - tongChi)],
  ]

  const buf = buildXlsx('Mau_B14_CD', rows)
  const filename = `CongDoan_Mau_B14_B15_${year}.xlsx`

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
