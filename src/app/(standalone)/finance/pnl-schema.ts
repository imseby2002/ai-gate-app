// 門市月度損益表（業績報表）科目樹 — 對照 FEELINGTEA 門市支費報表
// 順序即報表由上而下的列順序。kind 決定呈現樣式與計算方式。
//   revenue  : 營業額（百分比基數）
//   detail   : 可錄入／匯入的明細費用
//   subtotal : 小計／衍生（優先取存值，缺值時由 compute 規則計算）
//   compare  : 跨期比較（同比／環比，前端跨月計算）

export type PnlLineKind = 'revenue' | 'detail' | 'subtotal' | 'compare'
export type PnlSection = 'revenue' | 'fee' | 'rent' | 'alloc' | 'profit' | 'compare'

export interface PnlLine {
  code: string
  zh: string
  vi: string
  section: PnlSection
  kind: PnlLineKind
  /** subtotal 的計算規則（缺存值時用）。其餘為 undefined */
  compute?: PnlCompute
}

// 小計計算規則：sum=加總指定科目；formula=由其他小計推導
export type PnlCompute =
  | { op: 'sum'; codes: string[] }
  | { op: 'sub'; left: string; right: string }   // left - right
  | { op: 'sumSection'; section: PnlSection }     // 該分區所有 detail 加總

export const PNL_LINES: PnlLine[] = [
  // ── 營業額 ──
  { code: 'revenue', zh: '營業額', vi: 'doanh thu', section: 'revenue', kind: 'revenue' },

  // ── 門市可控費用 fee under control ──
  { code: 'ice',            zh: '冰塊費',   vi: 'tien da',            section: 'fee', kind: 'detail' },
  { code: 'electric',       zh: '電費',     vi: 'tien dien',          section: 'fee', kind: 'detail' },
  { code: 'water',          zh: '水費',     vi: 'tien nuoc',          section: 'fee', kind: 'detail' },
  { code: 'phone',          zh: '電話費',   vi: 'tien dien thoai',    section: 'fee', kind: 'detail' },
  { code: 'internet',       zh: '網路費',   vi: 'tien internet',      section: 'fee', kind: 'detail' },
  { code: 'gas',            zh: '瓦斯費',   vi: 'tien gas',           section: 'fee', kind: 'detail' },
  { code: 'fuel',           zh: '油費',     vi: 'tien xang',          section: 'fee', kind: 'detail' },
  { code: 'salary',         zh: '薪資',     vi: 'tien luong',         section: 'fee', kind: 'detail' },
  { code: 'insurance',      zh: '保險費',   vi: 'tien bao hiem',      section: 'fee', kind: 'detail' },
  { code: 'admin',          zh: '行政費',   vi: 'chi phi hanh chinh', section: 'fee', kind: 'detail' },
  { code: 'lixi',           zh: '紅包',     vi: 'lixi',               section: 'fee', kind: 'detail' },
  { code: 'sales_discount', zh: '銷售折扣', vi: 'chiet khau ban hang',section: 'fee', kind: 'detail' },
  { code: 'other_fee',      zh: '其他費用', vi: 'cp khac',            section: 'fee', kind: 'detail' },
  { code: 'material_used',  zh: '原料使用', vi: 'nl su dung',         section: 'fee', kind: 'detail' },
  { code: 'staff_meal',     zh: '員工餐',   vi: 'nv an',              section: 'fee', kind: 'detail' },
  { code: 'material_loss',  zh: '原料損耗', vi: 'hao hut nl',         section: 'fee', kind: 'detail' },
  { code: 'transport',      zh: '運輸費',   vi: 'van chuyen',         section: 'fee', kind: 'detail' },
  { code: 'security',       zh: '保安費',   vi: 'bao ve',             section: 'fee', kind: 'detail' },
  { code: 'fee_total',      zh: '可控費用合計', vi: 'tong fee under control', section: 'fee', kind: 'subtotal', compute: { op: 'sumSection', section: 'fee' } },
  { code: 'gross_profit',   zh: '毛利', vi: 'loi nhuan gop', section: 'fee', kind: 'subtotal', compute: { op: 'sub', left: 'revenue', right: 'fee_total' } },

  // ── 房租與房稅 ──
  { code: 'rent',                 zh: '房租',         vi: 'tien thue nha',                      section: 'rent', kind: 'detail' },
  { code: 'rent_tax',             zh: '房租稅',       vi: 'thue thue nha',                      section: 'rent', kind: 'detail' },
  { code: 'landlord_license_tax', zh: '房東牌照稅',   vi: 'thue mon bai cua chu nha',           section: 'rent', kind: 'detail' },
  { code: 'landlord_vat',         zh: '房東增值稅',   vi: 'thue GTGT cua chu nha',              section: 'rent', kind: 'detail' },
  { code: 'landlord_pit',         zh: '房東個人所得稅',vi: 'thue thu nhap ca nhan cua chu nha', section: 'rent', kind: 'detail' },
  { code: 'after_rent', zh: '扣房租與房稅後', vi: 'sau thue nha', section: 'rent', kind: 'subtotal', compute: { op: 'sub', left: 'gross_profit', right: '@rent_details' } },

  // ── 分攤費用與稅金 ──
  { code: 'alloc_office',         zh: '辦公室分攤', vi: 'phan bo chi phi vp',     section: 'alloc', kind: 'detail' },
  { code: 'alloc_warehouse',      zh: '倉庫分攤',   vi: 'phan bo chi phi kho',    section: 'alloc', kind: 'detail' },
  { code: 'advertising',          zh: '廣告費',     vi: 'phi quang cao',          section: 'alloc', kind: 'detail' },
  { code: 'repair',               zh: '維修費',     vi: 'chi phi sua chua',       section: 'alloc', kind: 'detail' },
  { code: 'pos_fee',              zh: 'POS機費',    vi: 'chi phi may pos',        section: 'alloc', kind: 'detail' },
  { code: 'biz_tax_personal',     zh: '營業稅(個體)',vi: 'thue kinh doanh-ch ca', section: 'alloc', kind: 'detail' },
  { code: 'license_tax_personal', zh: '牌照稅(個體)',vi: 'thue mon bai',          section: 'alloc', kind: 'detail' },
  { code: 'vat_personal',         zh: '增值稅(個體)',vi: 'thue gtgt',             section: 'alloc', kind: 'detail' },
  { code: 'pit_personal',         zh: '個人所得稅',  vi: 'thue thu nhap ca nhan', section: 'alloc', kind: 'detail' },
  { code: 'biz_tax_company',      zh: '營業稅(公司)',vi: 'thue kinh doanh -ch ct',section: 'alloc', kind: 'detail' },
  { code: 'license_tax_company',  zh: '牌照稅(公司)',vi: 'thue mon bai ct',       section: 'alloc', kind: 'detail' },
  { code: 'vat_company',          zh: '增值稅(公司)',vi: 'thue gtgt ct',          section: 'alloc', kind: 'detail' },
  { code: 'cit',                  zh: '企業所得稅',  vi: 'thue thu nhap doanh ng',section: 'alloc', kind: 'detail' },
  { code: 'total_cost', zh: '總費用', vi: 'tong chi phi', section: 'alloc', kind: 'subtotal', compute: { op: 'sub', left: 'revenue', right: 'result' } },

  // ── 利潤與獎金 ──
  { code: 'profit',            zh: '利潤',         vi: 'Loi Nhuan',          section: 'profit', kind: 'subtotal' },
  { code: 'bonus_kqkd1',       zh: '績效獎金1',    vi: 'thuong KQKD 1',      section: 'profit', kind: 'detail' },
  { code: 'bonus_kqkd2',       zh: '績效獎金2',    vi: 'thuong KQKD 2',      section: 'profit', kind: 'detail' },
  { code: 'bonus_kqkd_total',  zh: '績效獎金合計', vi: 'Tong thuong KQKD',   section: 'profit', kind: 'subtotal', compute: { op: 'sum', codes: ['bonus_kqkd1', 'bonus_kqkd2'] } },
  { code: 'bonus_achv1',       zh: '成就獎1',      vi: 'thuong thanh tich 1',section: 'profit', kind: 'detail' },
  { code: 'bonus_achv2',       zh: '成就獎2',      vi: 'thuong thanh tich 2',section: 'profit', kind: 'detail' },
  { code: 'bonus_revenue',     zh: '營收獎金',     vi: 'thuong doanh thu',   section: 'profit', kind: 'detail' },
  { code: 'bonus_total',       zh: '總獎金',       vi: 'Tong thuong',        section: 'profit', kind: 'subtotal', compute: { op: 'sum', codes: ['bonus_kqkd1', 'bonus_kqkd2', 'bonus_achv1', 'bonus_achv2', 'bonus_revenue'] } },
  { code: 'after_bonus',       zh: '扣除獎金後盈餘',vi: 'sau thuong',        section: 'profit', kind: 'subtotal', compute: { op: 'sub', left: 'result', right: 'bonus_total' } },
  { code: 'result',            zh: '最終結果',     vi: 'ket qua',            section: 'profit', kind: 'subtotal' },

  // ── 跨期比較（衍生，前端計算） ──
  { code: 'cmp_month', zh: '與上月同期比', vi: 'so sanh cung ky thang', section: 'compare', kind: 'compare' },
  { code: 'cmp_year',  zh: '與去年同期比', vi: 'so sanh cung ky nam',   section: 'compare', kind: 'compare' },
]

export const PNL_LINE_MAP: Record<string, PnlLine> = Object.fromEntries(PNL_LINES.map(l => [l.code, l]))

// 房租分區的明細科目（after_rent 用）
export const RENT_DETAIL_CODES = PNL_LINES.filter(l => l.section === 'rent' && l.kind === 'detail').map(l => l.code)

export const STORE_KIND_LABEL: Record<string, string> = {
  store: '門市', warehouse: '倉庫', office: '辦公室', group: '彙總',
}

// 匯入比對用：越文／中文別名 → line_code（小寫、去空白後比對）
export function buildLineAlias(): Record<string, string> {
  const m: Record<string, string> = {}
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[.,]/g, '')
  for (const l of PNL_LINES) {
    m[norm(l.vi)] = l.code
    m[norm(l.zh)] = l.code
    m[norm(l.code)] = l.code
  }
  return m
}
