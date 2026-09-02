// 越南法定勞動合同多版本範本引擎
export type ContractTemplateType = 'seasonal' | 'one_year' | 'indefinite' | 'probation'

export interface ContractVars {
  employee_name: string
  id_number: string
  birthday?: string
  address?: string
  phone?: string
  store?: string
  position: string
  salary: number | string
  salary_type?: 'monthly' | 'hourly'
  start_date: string
  end_date?: string
  company_name?: string
  company_address?: string
  representative?: string
}

export const TEMPLATE_NAMES: Record<ContractTemplateType, { name: string; vi: string; desc: string }> = {
  seasonal: {
    name: '兼職短約 / 計時人員合約',
    vi: 'Hợp đồng lao động thời vụ / Bán thời gian',
    desc: '適用於兼職、學生工讀、短天數排班計時同仁',
  },
  one_year: {
    name: '全職一年期固定期限合約',
    vi: 'Hợp đồng lao động xác định thời hạn (1 năm)',
    desc: '適用於通過試用期之正式全職門市或辦公室員工',
  },
  indefinite: {
    name: '無固定期限勞動合約',
    vi: 'Hợp đồng lao động không xác định thời hạn',
    desc: '連續續約兩次後法定必須簽訂之永久僱用合約',
  },
  probation: {
    name: '試用期勞動合約',
    vi: 'Hợp đồng thử việc',
    desc: '越南法規餐飲服務業最長 30 天試用期約',
  },
}

export function generateContractText(type: ContractTemplateType, vars: ContractVars): string {
  const comp = vars.company_name || 'CÔNG TY TNHH IM-TOURIST'
  const rep = vars.representative || 'Đại diện Ban Giám Đốc'
  const compAddr = vars.company_address || 'Việt Nam'

  const header = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------o0o--------\n\n${TEMPLATE_NAMES[type].vi.toUpperCase()}\n(${TEMPLATE_NAMES[type].name})\nSố: HĐLĐ-${vars.store || 'HQ'}-${new Date().getFullYear()}`

  const parties = `
BÊN SỬ DỤNG LAO ĐỘNG (雇主方 - Bên A):
- Tên công ty: ${comp}
- Đại diện bởi: ${rep}
- Địa chỉ trụ sở: ${compAddr}

BÊN NGƯỜI LAO ĐỘNG (勞工方 - Bên B):
- Họ và tên: ${vars.employee_name.toUpperCase()}
- Ngày sinh: ${vars.birthday || '---'}
- Số CCCD/Hộ chiếu: ${vars.id_number || '---'}
- Địa chỉ thường trú: ${vars.address || '---'}
- Điện thoại liên hệ: ${vars.phone || '---'}
`

  let terms = ''
  if (type === 'seasonal') {
    terms = `
ĐIỀU 1: THỜI HẠN VÀ CÔNG VIỆC HỢP ĐỒNG (工作期限與內容)
- Loại hợp đồng: Thời vụ / Bán thời gian (兼職/計時).
- Thời hạn: Từ ngày ${vars.start_date} ${vars.end_date ? `đến ngày ${vars.end_date}` : ''}.
- Địa điểm làm việc: ${vars.store ? `Cửa hàng ${vars.store}` : 'Hệ thống cửa hàng'}.
- Chức danh chuyên môn: ${vars.position}.

ĐIỀU 2: CHẾ ĐỘ LÀM VIỆC VÀ TIỀN LƯƠNG (工時與薪資)
- Mức lương: ${Number(vars.salary).toLocaleString()} VND / giờ (時薪).
- Lương ngày lễ, Tết: 300% theo quy định Luật Lao động Việt Nam.
- Lương làm thêm ca đêm (22:00 - 06:00): Cộng thêm ít nhất 30%.
- Hình thức trả lương: Chuyển khoản ngân hàng hàng tháng.`
  } else if (type === 'probation') {
    terms = `
ĐIỀU 1: THỜI HẠN THỬ VIỆC (試用期限)
- Thời gian thử việc: Từ ngày ${vars.start_date} đến ngày ${vars.end_date || '30 ngày'}.
- Chức danh: ${vars.position}.
- Địa điểm làm việc: ${vars.store ? `Cửa hàng ${vars.store}` : 'Văn phòng / Chi nhánh'}.

ĐIỀU 2: TIỀN LƯƠNG VÀ ĐIỀU KIỆN (薪資與考核)
- Lương thử việc: Bằng 85% mức lương chính thức (${Number(vars.salary).toLocaleString()} VND/tháng).
- Đánh giá sau thử việc: Đạt yêu cầu sẽ chuyển ký hợp đồng lao động chính thức.`
  } else {
    terms = `
ĐIỀU 1: THỜI HẠN VÀ ĐỊA ĐIỂM LÀM VIỆC (合約期限與工作地點)
- Loại hợp đồng: ${TEMPLATE_NAMES[type].vi}.
- Thời hạn: Từ ngày ${vars.start_date} ${vars.end_date ? `đến ngày ${vars.end_date}` : '(Không xác định thời hạn)'}.
- Địa điểm làm việc: ${vars.store ? `Cửa hàng ${vars.store}` : 'Văn phòng chính / Toàn hệ thống'}.
- Chức danh chuyên môn: ${vars.position}.

ĐIỀU 2: TIỀN LƯƠNG, BẢO HIỂM VÀ PHÚC LỢI (薪資、保險與福利)
- Lương cơ bản: ${Number(vars.salary).toLocaleString()} VND/tháng.
- Các khoản phụ cấp: Theo quy chế công ty (Cơm trưa, chuyên cần, chức vụ).
- Bảo hiểm bắt buộc: Đóng BHXH, BHYT, BHTN đầy đủ theo quy định pháp luật (Người lao động 10.5%, Người sử dụng lao động 21.5%).
- Nghỉ phép năm: 12 ngày phép có lương/năm.`
  }

  const footer = `
ĐIỀU 3: ĐIỀU KHOẢN THI HÀNH (執行條款)
- Hợp đồng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.
- Hợp đồng có hiệu lực kể từ ngày ký.

ĐẠI DIỆN BÊN A (雇主代表)                    NGƯỜI LAO ĐỘNG (勞工簽名)
(Ký, ghi rõ họ tên và đóng dấu)               (Ký, ghi rõ họ tên và điểm chỉ)
`

  return `${header}\n${parties}\n${terms}\n${footer}`
}
