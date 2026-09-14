// 公司單位（功能群）與其對應頁面。用於 /office 入口分群與存取判斷。
// 純常數與多語系支援，client/server 皆可 import。

// adminOnly：該頁權限尚未開放給單位員工（仍僅管理者）。各群的權限 PR 落地後拿掉此旗標。
export interface UnitPage {
  href: string
  label: string
  description?: string
  adminOnly?: boolean
}

export interface UnitArea {
  key: string
  label: string
  homeHref: string
  description: string
  pages: UnitPage[]
}

// 各單位群（access 以此 key 記於 profiles.units）- 預設繁體中文版
export const UNIT_AREAS: UnitArea[] = [
  {
    key: 'hr',
    label: '人事',
    homeHref: '/hr',
    description: '人事管理・考勤工時・薪資發放與人員名冊',
    pages: [
      { href: '/hr', label: '人事管理', description: '招募入職、考勤打卡、薪資計算、勞動合同與請假管理' },
      { href: '/personnel', label: '人員資料', description: '員工基本資料、身分文件、薪資獎金與履歷檔案' },
    ],
  },
  {
    key: 'finance',
    label: '出納・總務・會計',
    homeHref: '/finance',
    description: '出納帳務・門市收支・物料定價與廠商管理',
    pages: [
      { href: '/finance', label: '出納總務', description: '出納流水帳、帳戶管理、財務損益報表與資料匯入' },
      { href: '/finance?tab=pricing', label: '物料定價', description: '原料、設備、耗材之工廠進貨價、門市價與經銷價（出納專責統籌管理）' },
      { href: '/store-expenses', label: '門市費用', description: '門市水電瓦斯冰塊費用管理、收支明細與廠商填報' },
      { href: '/vendors', label: '廠商資料', description: '供應商基本資料、採購紀錄、結帳日與專屬免登入填報端' },
    ],
  },
  {
    key: 'rd',
    label: '研發',
    homeHref: '/rd',
    description: '飲品配方・門市成本試算・研發大腦與實驗日誌',
    pages: [
      { href: '/rd', label: '配方', description: '飲品配方設計、每杯門市成本（自動連動出納定價，研發不負責定價）與 POS 對照' },
      { href: '/rd-lab', label: '研發大腦 (R&D Lab)', description: 'AI 配方實驗室、原料特性、糖稅法規與 6 Agent 創新模型' },
      { href: '/rd-ai', label: '研發討論AI', description: '研發專用 AI 智能對話助手、配方調研與風味建議' },
      { href: '/rd-logs', label: '研發日誌', description: '配方研發紀錄、品評反饋與產品迭代歷程' },
    ],
  },
  {
    key: 'store',
    label: '門市營運',
    homeHref: '/store',
    description: '門市報表・盤點訂貨・水電瓦斯冰塊・現場報修排班',
    pages: [
      { href: '/store-coach', label: '門市營運教練 AI', description: '七大營運維度、現場動線空間配置、90秒快閃清潔、十層根因穿透診斷與現場視覺 AI' },
      { href: '/store-reports', label: '門市報表', description: '門市 POS 業績即時報表、毛利損益分析與門市銷售動態' },
      { href: '/store-inventory', label: '盤點・訂貨', description: '原物料庫存盤點、每日叫貨訂單、進貨驗收與耗損登記' },
      { href: '/store-bills', label: '水電費用填報', description: '每月電費、水費、瓦斯費、冰塊費申報與單據簽收憑證照片' },
      { href: '/repair', label: '門市報修', description: '門市設備故障即時申報、維修進度追蹤與器材保養台帳' },
      { href: '/repair?tab=ai&mode=store', label: '設備故障快速排查 AI', description: '吧檯設備與POS資訊故障免拆機引導、安全防呆與一鍵報修' },
      { href: '/shift', label: '門市排班', description: '門市人員輪值排班表、班別規劃與每月工時統計' },
      { href: '/pos', label: '門市點單 POS', description: '門市現場櫃台收銀點單、商品出單列印與即時銷售' },
    ],
  },
  {
    key: 'affairs',
    label: '外務・法規',
    homeHref: '/legal',
    description: '越南法律合規・各國進口規定・門市租約・營業執照',
    pages: [
      { href: '/legal', label: '法律合規 AI (越南法律/進口/門市)', description: '越南法律公務文書、各國食品設備進口規定與開門市手續引導' },
      { href: '/affairs', label: '外務・證照', description: '門市房屋租約、各類營業證照、到期提醒與自動預警' },
    ],
  },
  {
    key: 'audit',
    label: '稽核',
    homeHref: '/audit-platform',
    description: '企業稽核智慧平台・原物料推算引擎・Rule Engine 與 Copilot',
    pages: [
      { href: '/audit-platform', label: '企業稽核智慧平台', description: '四來源推算引擎、加料排擠修正、Rule Engine 四級規則與 Audit Copilot' },
      { href: '/audit', label: '原物料合理性', description: 'POS 銷售與進銷存交叉比對、原物料合理用量與異常損耗' },
      { href: '/audit-inspection', label: '門市現場巡檢', description: '現場巡查檢核表、環境衛生、物料品質巡檢評分' },
      { href: '/audit-ai', label: '稽核討論AI', description: '稽核異常分析、問答與查核建議 AI' },
      { href: '/audit-logs', label: '稽核日誌', description: '每日稽核紀錄、巡檢追蹤與改善追蹤事項' },
    ],
  },
  {
    key: 'marketing',
    label: '行銷',
    homeHref: '/mkt',
    description: '品牌中樞・視覺庫・外送平台與行銷自動化',
    pages: [
      { href: '/marketing', label: '行銷中心 (marketing.im-tourist.com)', description: '行銷自動化、AI 視覺工坊、流水線與潛在客戶外呼開發' },
      { href: '/marketing/logbook', label: '行銷日誌', description: '行銷活動計畫、社群發布紀錄與效益追蹤' },
      { href: '/mkt', label: '門市實體行銷與外送平台', description: '品牌視覺庫、各分店專屬行銷活動與外送平台整合' },
    ],
  },
  {
    key: 'repair',
    label: '維修',
    homeHref: '/repair',
    description: '設備保養台帳・工單維修進度・故障排除與機電AI助理',
    pages: [
      { href: '/repair', label: '設備・報修', description: '全公司各據點設備報修工單、修繕歷程與器材台帳' },
      { href: '/repair?tab=ai', label: '維修 AI 助理 (雙模式)', description: '門市免拆機快速排查、技師工程電路診斷、原廠手冊RAG與冷啟動推導' },
    ],
  },
  {
    key: 'gm',
    label: '總經理室',
    homeHref: '/gm',
    description: '全公司經營儀表板・異常紅旗・AI經營快報',
    pages: [
      { href: '/gm', label: '經營儀表板', description: '營收利潤綜合看板、跨部門異常警戒與 AI 每日快報' },
    ],
  },
]

// 越文 (Tiếng Việt) 單位群定義
export const UNIT_AREAS_VI: UnitArea[] = [
  {
    key: 'hr',
    label: 'Nhân sự',
    homeHref: '/hr',
    description: 'Quản lý nhân sự, chấm công, tính lương và danh sách nhân viên',
    pages: [
      { href: '/hr', label: 'Quản lý nhân sự', description: 'Tuyển dụng, chấm công, tính lương, hợp đồng lao động và nghỉ phép' },
      { href: '/personnel', label: 'Hồ sơ nhân viên', description: 'Thông tin nhân viên, giấy tờ tùy thân, lương thưởng và hồ sơ' },
    ],
  },
  {
    key: 'finance',
    label: 'Thủ quỹ ・ Hành chính ・ Kế toán',
    homeHref: '/finance',
    description: 'Sổ quỹ thu chi, tài chính cửa hàng, định giá nguyên liệu & nhà cung cấp',
    pages: [
      { href: '/finance', label: 'Thủ quỹ & Hành chính', description: 'Thu chi tiền mặt, quản lý tài khoản, báo cáo lỗ lãi & nhập dữ liệu' },
      { href: '/finance?tab=pricing', label: 'Định giá nguyên vật liệu', description: 'Giá nhập xưởng, giá bán chi nhánh và đại lý (Thủ quỹ quản lý chuyên trách)' },
      { href: '/store-expenses', label: 'Chi phí chi nhánh', description: 'Quản lý chi phí điện nước gas đá lạnh cửa hàng & kê khai từ nhà cung cấp' },
      { href: '/vendors', label: 'Nhà cung cấp', description: 'Thông tin nhà cung cấp, lịch sử mua hàng, ngày thanh toán & trang kê khai' },
    ],
  },
  {
    key: 'rd',
    label: 'Nghiên cứu & Phát triển (R&D)',
    homeHref: '/rd',
    description: 'Công thức đồ uống, tính giá vốn ly nước, R&D Lab & nhật ký pha chế',
    pages: [
      { href: '/rd', label: 'Công thức đồ uống', description: 'Thiết kế công thức, giá vốn mỗi ly (liên kết định giá thủ quỹ) & đối chiếu POS' },
      { href: '/rd-lab', label: 'Bộ não R&D (R&D Lab)', description: 'Phòng lab công thức AI, đặc tính nguyên liệu, thuế đường & 6 Agent sáng tạo' },
      { href: '/rd-ai', label: 'AI Thảo luận R&D', description: 'Trợ lý đối thoại AI R&D, nghiên cứu công thức & tư vấn hương vị' },
      { href: '/rd-logs', label: 'Nhật ký R&D', description: 'Ghi chép thử nghiệm, phản hồi thử vị & lộ trình cải tiến sản phẩm' },
    ],
  },
  {
    key: 'store',
    label: 'Vận hành cửa hàng',
    homeHref: '/store',
    description: 'Báo cáo doanh thu, kiểm kho đặt hàng, điện nước gas, bảo trì & xếp ca',
    pages: [
      { href: '/store-coach', label: 'AI Huấn luyện viên vận hành', description: '7 khía cạnh vận hành, tối ưu luồng di chuyển, dọn dẹp 90s, chẩn đoán 10 tầng & AI thị giác' },
      { href: '/store-reports', label: 'Báo cáo cửa hàng', description: 'Doanh thu POS trực tiếp, phân tích lợi nhuận gộp & xu hướng bán hàng' },
      { href: '/store-inventory', label: 'Kiểm kho ・ Đặt hàng', description: 'Kiểm kê kho nguyên liệu, đơn đặt hàng mỗi ngày, nghiệm thu & ghi nhận hao hụt' },
      { href: '/store-bills', label: 'Kê khai tiền điện nước', description: 'Kê khai chi phí điện, nước, gas, đá lạnh hàng tháng kèm ảnh hóa đơn chứng từ' },
      { href: '/repair', label: 'Báo hỏng & Sửa chữa', description: 'Báo hỏng thiết bị trực tiếp, theo dõi tiến độ sửa chữa & sổ bảo dưỡng' },
      { href: '/repair?tab=ai&mode=store', label: 'AI Chẩn đoán thiết bị nhanh', description: 'Hướng dẫn không tháo máy, an toàn chống lỗi & chuyển báo hỏng 1 chạm' },
      { href: '/shift', label: 'Xếp ca làm việc', description: 'Lịch phân ca nhân viên, kế hoạch ca làm & thống kê giờ công' },
      { href: '/pos', label: 'POS Bán hàng tại quầy', description: 'Bán hàng thu ngân tại quầy, in hóa đơn & quản lý đơn tức thì' },
    ],
  },
  {
    key: 'affairs',
    label: 'Hành chính & Pháp lý',
    homeHref: '/legal',
    description: 'Tuân thủ pháp luật VN, quy định xuất nhập khẩu, hợp đồng thuê & giấy phép',
    pages: [
      { href: '/legal', label: 'AI Pháp lý & Tuân thủ', description: 'Soạn thảo công văn, quy định nhập khẩu máy móc thực phẩm & thủ tục mở quán' },
      { href: '/affairs', label: 'Hồ sơ & Giấy phép', description: 'Hợp đồng thuê mặt bằng, các loại giấy phép kinh doanh, nhắc nhở hết hạn' },
    ],
  },
  {
    key: 'audit',
    label: 'Kiểm toán & Thanh tra',
    homeHref: '/audit-platform',
    description: 'Nền tảng kiểm toán thông minh, ước tính nguyên liệu, Rule Engine & Copilot',
    pages: [
      { href: '/audit-platform', label: 'Nền tảng kiểm toán AI', description: 'Động cơ tính toán 4 nguồn, điều chỉnh topping, 4 cấp quy tắc & Audit Copilot' },
      { href: '/audit', label: 'Tính hợp lý của nguyên liệu', description: 'Đối chiếu POS và xuất nhập tồn, lượng dùng định mức & hao hụt bất thường' },
      { href: '/audit-inspection', label: 'Thanh tra hiện trường', description: 'Bảng kiểm tra thực địa, vệ sinh môi trường & chấm điểm chất lượng' },
      { href: '/audit-ai', label: 'AI Thảo luận kiểm toán', description: 'Phân tích bất thường kiểm toán, hỏi đáp và kiến nghị thanh tra' },
      { href: '/audit-logs', label: 'Nhật ký kiểm toán', description: 'Nhật ký thanh tra hằng ngày, theo dõi khắc phục & cải thiện' },
    ],
  },
  {
    key: 'marketing',
    label: 'Tiếp thị & Thương hiệu',
    homeHref: '/mkt',
    description: 'Trung tâm thương hiệu, thư viện hình ảnh, app giao hàng & tự động hóa',
    pages: [
      { href: '/marketing', label: 'Trung tâm Marketing', description: 'Tự động hóa tiếp thị, xưởng hình ảnh AI, pipeline & tiếp cận khách hàng' },
      { href: '/marketing/logbook', label: 'Nhật ký Marketing', description: 'Kế hoạch chiến dịch tiếp thị, lịch đăng mạng xã hội & đo lường hiệu quả' },
      { href: '/mkt', label: 'Marketing cửa hàng & App giao hàng', description: 'Thư viện visual thương hiệu, chương trình từng chi nhánh & tích hợp app giao hàng' },
    ],
  },
  {
    key: 'repair',
    label: 'Bảo trì & Kỹ thuật',
    homeHref: '/repair',
    description: 'Sổ tài sản thiết bị, tiến độ công việc sửa chữa & trợ lý cơ điện AI',
    pages: [
      { href: '/repair', label: 'Thiết bị & Báo hỏng', description: 'Phiếu báo hỏng toàn công ty, lịch sử sửa chữa & danh mục thiết bị' },
      { href: '/repair?tab=ai', label: 'Trợ lý AI Bảo trì (2 chế độ)', description: 'Chẩn đoán nhanh tại quán, kỹ thuật đo mạch điện, RAG cẩm nang & khởi động lạnh' },
    ],
  },
  {
    key: 'gm',
    label: 'Văn phòng Tổng Giám Đốc',
    homeHref: '/gm',
    description: 'Bảng điều khiển kinh doanh toàn công ty, cờ đỏ cảnh báo & báo cáo nhanh AI',
    pages: [
      { href: '/gm', label: 'Bảng điều khiển kinh doanh', description: 'Bảng tổng hợp doanh thu lợi nhuận, cảnh báo bất thường & bản tin AI hằng ngày' },
    ],
  },
]

// 英文 (English) 單位群定義
export const UNIT_AREAS_EN: UnitArea[] = [
  {
    key: 'hr',
    label: 'HR',
    homeHref: '/hr',
    description: 'Human resources, attendance, payroll and staff directory',
    pages: [
      { href: '/hr', label: 'HR Management', description: 'Recruitment, attendance, payroll, labor contracts, and leave' },
      { href: '/personnel', label: 'Personnel Files', description: 'Staff profiles, identification docs, compensation and resumes' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance & Admin',
    homeHref: '/finance',
    description: 'Cashier accounts, store revenue/expenses, pricing & vendor management',
    pages: [
      { href: '/finance', label: 'Cashier & Admin', description: 'Cash ledger, accounts, P&L financial reports and data import' },
      { href: '/finance?tab=pricing', label: 'Material Pricing', description: 'Factory cost, store price, and distributor price (Cashier managed)' },
      { href: '/store-expenses', label: 'Store Expenses', description: 'Store utilities, expense breakdown, and vendor submissions' },
      { href: '/vendors', label: 'Vendor Directory', description: 'Supplier profiles, purchase history, billing dates, and vendor portal' },
    ],
  },
  {
    key: 'rd',
    label: 'R&D',
    homeHref: '/rd',
    description: 'Beverage recipes, store cost calculation, R&D brain and lab logs',
    pages: [
      { href: '/rd', label: 'Drink Recipes', description: 'Drink recipe design, cost per cup (linked to cashier pricing), and POS mapping' },
      { href: '/rd-lab', label: 'R&D Lab Brain', description: 'AI recipe lab, ingredient specs, sugar tax rules, and 6-agent model' },
      { href: '/rd-ai', label: 'R&D Discussion AI', description: 'Dedicated AI assistant for recipe research and flavor recommendations' },
      { href: '/rd-logs', label: 'R&D Logs', description: 'Recipe development logs, tasting feedback, and iteration history' },
    ],
  },
  {
    key: 'store',
    label: 'Store Operations',
    homeHref: '/store',
    description: 'Store reports, stock inventory, utilities, maintenance and shifts',
    pages: [
      { href: '/store-coach', label: 'Store Management Coach AI', description: '7 operation dimensions, layout ergonomics, 90s cleaning, 10-layer diagnosis & vision AI' },
      { href: '/store-reports', label: 'Store Reports', description: 'Real-time POS sales reports, gross profit margin, and sales trends' },
      { href: '/store-inventory', label: 'Inventory & Orders', description: 'Material stock counts, daily purchase orders, receiving, and waste logs' },
      { href: '/store-bills', label: 'Utility Expense Bills', description: 'Monthly electricity, water, gas, and ice bills with invoice uploads' },
      { href: '/repair', label: 'Store Maintenance', description: 'Equipment fault reporting, progress tracking, and maintenance logs' },
      { href: '/repair?tab=ai&mode=store', label: 'Quick Diagnostic AI', description: 'No-disassembly safe troubleshooting for bar equipment & 1-click dispatch' },
      { href: '/shift', label: 'Shift Scheduling', description: 'Staff shift roster, shift planning, and monthly working hours' },
      { href: '/pos', label: 'Counter POS', description: 'Counter order taking, receipt printing, and real-time sales register' },
    ],
  },
  {
    key: 'affairs',
    label: 'Legal & Affairs',
    homeHref: '/legal',
    description: 'Vietnam legal compliance, import rules, store leases, and licenses',
    pages: [
      { href: '/legal', label: 'Legal Compliance AI', description: 'Vietnam legal documents, import regulations, and store licensing guide' },
      { href: '/affairs', label: 'Affairs & Licenses', description: 'Property leases, business licenses, expiration reminders, and alerts' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit',
    homeHref: '/audit-platform',
    description: 'Audit intelligence platform, consumption estimation engine, Rule Engine & Copilot',
    pages: [
      { href: '/audit-platform', label: 'Audit Intelligence Platform', description: '4-source consumption engine, topping displacement, 4-tier rule engine & Copilot' },
      { href: '/audit', label: 'Material Variance', description: 'Cross-checking POS sales vs inventory, theoretical usage, and variance' },
      { href: '/audit-inspection', label: 'Store Inspection', description: 'Store audit checklist, hygiene standards, and material quality scoring' },
      { href: '/audit-ai', label: 'Audit AI Copilot', description: 'Audit anomaly analysis, Q&A, and inspection guidance AI' },
      { href: '/audit-logs', label: 'Audit Logs', description: 'Daily audit logs, inspection follow-ups, and corrective action items' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    homeHref: '/mkt',
    description: 'Brand hub, visual assets, delivery platforms, and marketing automation',
    pages: [
      { href: '/marketing', label: 'Marketing Hub', description: 'Marketing automation, AI visual workshop, sales pipeline, and outbound calls' },
      { href: '/marketing/logbook', label: 'Marketing Logbook', description: 'Campaign plans, social media scheduling, and performance tracking' },
      { href: '/mkt', label: 'Store Marketing & Delivery', description: 'Brand visual library, store-specific campaigns, and delivery integration' },
    ],
  },
  {
    key: 'repair',
    label: 'Maintenance',
    homeHref: '/repair',
    description: 'Equipment asset registry, work orders, troubleshooting, and electromechanical AI',
    pages: [
      { href: '/repair', label: 'Equipment & Orders', description: 'Company-wide maintenance tickets, repair history, and asset registry' },
      { href: '/repair?tab=ai', label: 'Repair AI Assistant (Dual Mode)', description: 'Store no-disassembly triage, technician circuit diagnosis, RAG manuals & cold start' },
    ],
  },
  {
    key: 'gm',
    label: 'Executive Office',
    homeHref: '/gm',
    description: 'Executive dashboard, red flag alerts, and daily AI executive briefing',
    pages: [
      { href: '/gm', label: 'Executive Dashboard', description: 'Revenue & profit dashboard, cross-department alerts, and daily AI digest' },
    ],
  },
]

// 共用／全公司層級（屬於公司整個，所有登入同仁皆可見）- 預設繁中
export const COMMON_PAGES: UnitPage[] = [
  { href: '/units', label: '單位資料' },
  { href: '/office?tab=proposals', label: '💡 問題與想法' },
  { href: '/work', label: '任務' },
  { href: '/meeting', label: '會議紀錄' },
  { href: '/legal', label: '法律合規 AI' },
]

export const COMMON_PAGES_VI: UnitPage[] = [
  { href: '/units', label: 'Dữ liệu phòng ban' },
  { href: '/office?tab=proposals', label: '💡 Vấn đề & Ý tưởng' },
  { href: '/work', label: 'Nhiệm vụ' },
  { href: '/meeting', label: 'Biên bản cuộc họp' },
  { href: '/legal', label: 'AI Pháp lý & Tuân thủ' },
]

export const COMMON_PAGES_EN: UnitPage[] = [
  { href: '/units', label: 'Department Directory' },
  { href: '/office?tab=proposals', label: '💡 Problems & Ideas' },
  { href: '/work', label: 'Tasks' },
  { href: '/meeting', label: 'Meeting Minutes' },
  { href: '/legal', label: 'Legal Compliance AI' },
]

// 多語系取得方法
export function getLocalizedUnitAreas(locale?: string): UnitArea[] {
  if (locale === 'vi') return UNIT_AREAS_VI
  if (locale === 'en') return UNIT_AREAS_EN
  return UNIT_AREAS
}

export function getLocalizedCommonPages(locale?: string): UnitPage[] {
  if (locale === 'vi') return COMMON_PAGES_VI
  if (locale === 'en') return COMMON_PAGES_EN
  return COMMON_PAGES
}

export function getLocalizedUnitLabel(locale?: string): Record<string, string> {
  const areas = getLocalizedUnitAreas(locale)
  const map: Record<string, string> = Object.fromEntries(areas.map(a => [a.key, a.label]))
  if (locale === 'vi') {
    map.system = 'Toàn hệ thống'
  } else if (locale === 'en') {
    map.system = 'System-wide'
  } else {
    map.system = '全系統共用'
  }
  return map
}

export function getLocalizedDepartments(locale?: string): { key: string; label: string; icon: string }[] {
  const labels = getLocalizedUnitLabel(locale)
  return [
    { key: 'store',     label: labels.store || '門市營運',     icon: '🏪' },
    { key: 'finance',   label: labels.finance || '出納總務',   icon: '💰' },
    { key: 'rd',        label: labels.rd || '研發配方',       icon: '🧪' },
    { key: 'hr',        label: labels.hr || '人事管理',       icon: '👥' },
    { key: 'audit',     label: labels.audit || '稽核巡檢',     icon: '🛡️' },
    { key: 'repair',    label: labels.repair || '設備維修',    icon: '🔧' },
    { key: 'affairs',   label: labels.affairs || '外務證照',   icon: '📑' },
    { key: 'marketing', label: labels.marketing || '品牌行銷', icon: '📣' },
    { key: 'gm',        label: labels.gm || '總經理室',       icon: '👑' },
    { key: 'system',    label: labels.system || '全系統共用',   icon: '🌐' },
  ]
}

export const UNIT_LABEL: Record<string, string> = {
  ...Object.fromEntries(UNIT_AREAS.map(a => [a.key, a.label])),
  system: '全系統共用',
}

// 是否可存取某單位群（管理者全開；marketing 與 mkt 雙向相容）
export function hasUnit(isAdmin: boolean, units: string[] | null | undefined, key: string): boolean {
  if (isAdmin) return true
  const list = units ?? []
  if (key === 'marketing' || key === 'mkt') {
    return list.includes('marketing') || list.includes('mkt')
  }
  return list.includes(key)
}
