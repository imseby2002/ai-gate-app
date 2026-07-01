// 門市月度損益表（業績報表）科目樹 — 對照 FEELINGTEA 門市支費報表，依「四道利潤線」分層
// 順序即報表由上而下的列順序。kind 決定呈現樣式與計算方式。
//   revenue  : 營業額（百分比基數）
//   detail   : 可錄入／匯入的明細
//   subtotal : 小計／利潤線（存值優先，缺值才由 compute 計算）
//   compare  : 跨期比較（同比／環比，前端跨月計算）
//
// 四道利潤線：
//   營業額 −成本 → ①毛利 −營運 → ②店面營業利益 −租金 → ③扣租後 −分攤−稅金 → ④淨利 −獎金 → 獎金後盈餘

export type PnlLineKind = 'revenue' | 'detail' | 'subtotal' | 'compare'
export type PnlSection =
  | 'revenue' | 'cogs' | 'opex' | 'rent' | 'alloc' | 'tax' | 'bonus' | 'compare'

export interface PnlLine {
  code: string
  zh: string
  vi: string
  section: PnlSection | string
  kind: PnlLineKind
  compute?: PnlCompute | null
  archived?: boolean
}

// 小計計算規則（缺存值時用）
export type PnlCompute =
  | { op: 'sumSection'; section: PnlSection }      // 該分區所有 detail 加總
  | { op: 'sum'; codes: string[] }                 // 指定科目加總
  | { op: 'sub'; left: string; right: string }     // left − right
  | { op: 'subMany'; base: string; minus: string[] } // base − Σminus

// 各利潤線分區標題（單店趨勢檢視分組用）
export const PNL_SECTION_LABEL: Record<PnlSection, string> = {
  revenue: '營業額', cogs: '銷貨成本', opex: '門市營運費用',
  rent: '租金', alloc: '總部分攤', tax: '稅金', bonus: '獎金', compare: '比較',
}

export const PNL_LINES: PnlLine[] = [
  // ── 營業額 ──
  { code: 'revenue', zh: '營業額', vi: 'doanh thu', section: 'revenue', kind: 'revenue' },

  // ── ① 銷貨成本（原料） → 毛利 ──
  { code: 'material_used',  zh: '原料使用', vi: 'nl su dung', section: 'cogs', kind: 'detail' },
  { code: 'material_loss',  zh: '原料損耗', vi: 'hao hut nl', section: 'cogs', kind: 'detail' },
  { code: 'ice',            zh: '冰塊',     vi: 'tien da',    section: 'cogs', kind: 'detail' },
  { code: 'cogs_total',     zh: '銷貨成本合計', vi: 'tong gia von', section: 'cogs', kind: 'subtotal', compute: { op: 'sumSection', section: 'cogs' } },
  { code: 'gross_profit',   zh: '① 毛利', vi: 'loi nhuan gop', section: 'cogs', kind: 'subtotal', compute: { op: 'sub', left: 'revenue', right: 'cogs_total' } },

  // ── ② 門市營運費用 → 店面營業利益 ──
  { code: 'salary',         zh: '薪資',     vi: 'tien luong',         section: 'opex', kind: 'detail' },
  { code: 'insurance',      zh: '保險費',   vi: 'tien bao hiem',      section: 'opex', kind: 'detail' },
  { code: 'electric',       zh: '電費',     vi: 'tien dien',          section: 'opex', kind: 'detail' },
  { code: 'water',          zh: '水費',     vi: 'tien nuoc',          section: 'opex', kind: 'detail' },
  { code: 'gas',            zh: '瓦斯費',   vi: 'tien gas',           section: 'opex', kind: 'detail' },
  { code: 'phone',          zh: '電話費',   vi: 'tien dien thoai',    section: 'opex', kind: 'detail' },
  { code: 'internet',       zh: '網路費',   vi: 'tien internet',      section: 'opex', kind: 'detail' },
  { code: 'fuel',           zh: '油費',     vi: 'tien xang',          section: 'opex', kind: 'detail' },
  { code: 'transport',      zh: '運輸費',   vi: 'van chuyen',         section: 'opex', kind: 'detail' },
  { code: 'staff_meal',     zh: '員工餐',   vi: 'nv an',              section: 'opex', kind: 'detail' },
  { code: 'security',       zh: '保安費',   vi: 'bao ve',             section: 'opex', kind: 'detail' },
  { code: 'admin',          zh: '行政費',   vi: 'chi phi hanh chinh', section: 'opex', kind: 'detail' },
  { code: 'lixi',           zh: '紅包',     vi: 'lixi',               section: 'opex', kind: 'detail' },
  { code: 'sales_discount', zh: '銷售折扣', vi: 'chiet khau ban hang',section: 'opex', kind: 'detail' },
  { code: 'other_fee',      zh: '其他費用', vi: 'cp khac',            section: 'opex', kind: 'detail' },
  { code: 'opex_total',     zh: '營運費用合計', vi: 'tong chi phi van hanh', section: 'opex', kind: 'subtotal', compute: { op: 'sumSection', section: 'opex' } },
  { code: 'store_profit',   zh: '② 店面營業利益', vi: 'loi nhuan cua hang', section: 'opex', kind: 'subtotal', compute: { op: 'sub', left: 'gross_profit', right: 'opex_total' } },

  // ── ③ 租金 → 扣租後利益 ──
  { code: 'rent',                 zh: '房租',         vi: 'tien thue nha',                      section: 'rent', kind: 'detail' },
  { code: 'rent_tax',             zh: '房租稅',       vi: 'thue thue nha',                      section: 'rent', kind: 'detail' },
  { code: 'landlord_license_tax', zh: '房東牌照稅',   vi: 'thue mon bai cua chu nha',           section: 'rent', kind: 'detail' },
  { code: 'landlord_vat',         zh: '房東增值稅',   vi: 'thue GTGT cua chu nha',              section: 'rent', kind: 'detail' },
  { code: 'landlord_pit',         zh: '房東個人所得稅',vi: 'thue thu nhap ca nhan cua chu nha', section: 'rent', kind: 'detail' },
  { code: 'rent_total',           zh: '租金合計',     vi: 'tong tien nha', section: 'rent', kind: 'subtotal', compute: { op: 'sumSection', section: 'rent' } },
  { code: 'after_rent',           zh: '③ 扣租後利益', vi: 'sau thue nha', section: 'rent', kind: 'subtotal', compute: { op: 'sub', left: 'store_profit', right: 'rent_total' } },

  // ── 總部分攤 ──
  { code: 'alloc_office',    zh: '辦公室分攤', vi: 'phan bo chi phi vp',  section: 'alloc', kind: 'detail' },
  { code: 'alloc_warehouse', zh: '倉庫分攤',   vi: 'phan bo chi phi kho', section: 'alloc', kind: 'detail' },
  { code: 'advertising',     zh: '廣告費',     vi: 'phi quang cao',       section: 'alloc', kind: 'detail' },
  { code: 'repair',          zh: '維修攤提',   vi: 'chi phi sua chua',    section: 'alloc', kind: 'detail' },
  { code: 'pos_fee',         zh: '設備/POS',   vi: 'chi phi may pos',     section: 'alloc', kind: 'detail' },
  { code: 'alloc_total',     zh: '分攤合計',   vi: 'tong phan bo', section: 'alloc', kind: 'subtotal', compute: { op: 'sumSection', section: 'alloc' } },

  // ── 稅金（保留越南細項：個體 ch ca／公司 ch ct） ──
  { code: 'biz_tax_personal',     zh: '營業稅(個體)', vi: 'thue kinh doanh-ch ca',  section: 'tax', kind: 'detail' },
  { code: 'license_tax_personal', zh: '牌照稅(個體)', vi: 'thue mon bai ca',        section: 'tax', kind: 'detail' },
  { code: 'vat_personal',         zh: '增值稅(個體)', vi: 'thue gtgt ca',           section: 'tax', kind: 'detail' },
  { code: 'pit_personal',         zh: '個人所得稅',   vi: 'thue thu nhap ca nhan',  section: 'tax', kind: 'detail' },
  { code: 'biz_tax_company',      zh: '營業稅(公司)', vi: 'thue kinh doanh -ch ct', section: 'tax', kind: 'detail' },
  { code: 'license_tax_company',  zh: '牌照稅(公司)', vi: 'thue mon bai ct',        section: 'tax', kind: 'detail' },
  { code: 'vat_company',          zh: '增值稅(公司)', vi: 'thue gtgt ct',           section: 'tax', kind: 'detail' },
  { code: 'cit',                  zh: '企業所得稅',   vi: 'thue thu nhap doanh ng', section: 'tax', kind: 'detail' },
  { code: 'tax_total',  zh: '稅金合計', vi: 'tong thue', section: 'tax', kind: 'subtotal', compute: { op: 'sumSection', section: 'tax' } },
  { code: 'total_cost', zh: '總費用',   vi: 'tong chi phi', section: 'tax', kind: 'subtotal', compute: { op: 'sub', left: 'revenue', right: 'profit' } },
  { code: 'profit',     zh: '④ 淨利',   vi: 'Loi Nhuan', section: 'tax', kind: 'subtotal', compute: { op: 'subMany', base: 'after_rent', minus: ['alloc_total', 'tax_total'] } },

  // ── 獎金 → 獎金後盈餘 ──
  { code: 'bonus_kqkd1',   zh: '績效獎金1', vi: 'thuong KQKD 1',      section: 'bonus', kind: 'detail' },
  { code: 'bonus_kqkd2',   zh: '績效獎金2', vi: 'thuong KQKD 2',      section: 'bonus', kind: 'detail' },
  { code: 'bonus_achv1',   zh: '成就獎1',   vi: 'thuong thanh tich 1',section: 'bonus', kind: 'detail' },
  { code: 'bonus_achv2',   zh: '成就獎2',   vi: 'thuong thanh tich 2',section: 'bonus', kind: 'detail' },
  { code: 'bonus_revenue', zh: '營收獎金',  vi: 'thuong doanh thu',   section: 'bonus', kind: 'detail' },
  { code: 'bonus_total',   zh: '獎金合計',  vi: 'Tong thuong', section: 'bonus', kind: 'subtotal', compute: { op: 'sumSection', section: 'bonus' } },
  { code: 'result',        zh: '獎金後盈餘',vi: 'ket qua', section: 'bonus', kind: 'subtotal', compute: { op: 'sub', left: 'profit', right: 'bonus_total' } },

  // ── 跨期比較（衍生，前端計算） ──
  { code: 'cmp_month', zh: '與上月同期比', vi: 'so sanh cung ky thang', section: 'compare', kind: 'compare' },
  { code: 'cmp_year',  zh: '與去年同期比', vi: 'so sanh cung ky nam',   section: 'compare', kind: 'compare' },
]

export const PNL_LINE_MAP: Record<string, PnlLine> = Object.fromEntries(PNL_LINES.map(l => [l.code, l]))

export const STORE_KIND_LABEL: Record<string, string> = {
  store: '門市', warehouse: '倉庫', office: '辦公室', group: '彙總',
}

// 匯入比對用：越文／中文別名 → line_code（小寫、去空白標點後比對）
export function buildLineAlias(): Record<string, string> {
  const m: Record<string, string> = {}
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[.,\-/()]/g, '')
  for (const l of PNL_LINES) {
    m[norm(l.vi)] = l.code
    m[norm(l.zh)] = l.code
    m[norm(l.code)] = l.code
  }
  return m
}
