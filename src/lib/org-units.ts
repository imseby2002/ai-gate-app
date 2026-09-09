// 公司單位（功能群）與其對應頁面。用於 /office 入口分群與存取判斷。
// 純常數，client/server 皆可 import。

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

// 各單位群（access 以此 key 記於 profiles.units）
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
    description: '設備保養台帳・工單維修進度與故障排除',
    pages: [
      { href: '/repair', label: '設備・報修', description: '全公司各據點設備報修工單、修繕歷程與器材台帳' },
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

// 共用／全公司層級（屬於公司整個，所有登入同仁皆可見，單位資料置頂）
export const COMMON_PAGES: UnitPage[] = [
  { href: '/units', label: '單位資料' },
  { href: '/office?tab=proposals', label: '💡 問題與想法' },
  { href: '/work', label: '任務' },
  { href: '/meeting', label: '會議紀錄' },
]

export const UNIT_LABEL: Record<string, string> = Object.fromEntries(UNIT_AREAS.map(a => [a.key, a.label]))

// 是否可存取某單位群（管理者全開；marketing 與 mkt 雙向相容）
export function hasUnit(isAdmin: boolean, units: string[] | null | undefined, key: string): boolean {
  if (isAdmin) return true
  const list = units ?? []
  if (key === 'marketing' || key === 'mkt') {
    return list.includes('marketing') || list.includes('mkt')
  }
  return list.includes(key)
}
