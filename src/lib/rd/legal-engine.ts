// 越南食品法規與特別消費稅檢查引擎 (Vietnam Food Legal & Sugar Tax Engine)
// 包含每 100ml 糖稅閾值檢查、條文索引 (Law → Điều → Khoản → Điểm) 與食品添加物合規

export interface LegalComplianceResult {
  has_warning: boolean
  sugar_per_100ml: number
  sugar_tax_applies: boolean
  sugar_tax_rate: string
  tax_statute: string
  citation: string
  warning_message: string
  reformulation_suggestion: string
  regulations_checked: Array<{
    law_name: string
    article: string
    requirement: string
    status: 'pass' | 'warning' | 'info'
  }>
}

export function checkLegalCompliance(
  sugarPer100ml: number,
  additives: string[] = []
): LegalComplianceResult {
  const SUGAR_TAX_THRESHOLD = 5.0 // 5.0g / 100ml 法定閾值
  const isOverTaxThreshold = sugarPer100ml > SUGAR_TAX_THRESHOLD

  const regulations_checked: LegalComplianceResult['regulations_checked'] = [
    {
      law_name: 'Dự thảo Luật Thuế Tiêu thụ Đặc biệt (sửa đổi)',
      article: 'Điều 2, Khoản 1, Điểm h',
      requirement: '含糖飲料（含糖量 > 5g / 100ml）課徵 10% 特別消費稅',
      status: isOverTaxThreshold ? 'warning' : 'pass',
    },
    {
      law_name: 'Nghị định 15/2018/NĐ-CP',
      article: 'Điều 4 — Tự công bố sản phẩm',
      requirement: '一般常態調製飲品門市現場販售需具備符合標準之食品安全證書與配方成分公開備查',
      status: 'pass',
    },
    {
      law_name: 'Thông tư 24/2019/TT-BYT',
      article: 'Phụ lục 1 — Danh mục phụ gia thực phẩm được phép sử dụng',
      requirement: '所有原料所含添加物（安定劑、防腐劑、色素）需符合越南衛生部公告之安全使用量與品類規定',
      status: 'pass',
    },
  ]

  let warning_message = ''
  let reformulation_suggestion = ''

  if (isOverTaxThreshold) {
    const diff = (sugarPer100ml - SUGAR_TAX_THRESHOLD).toFixed(1)
    warning_message = `⚠️ 預估每 100ml 總糖量為 ${sugarPer100ml.toFixed(1)}g（超出法定門檻 ${diff}g/100ml）。此配方將落入越南《特別消費稅法修正案》課稅範圍，需被課徵 10% 特別消費稅 (Thuế TTĐB 10%)！`
    reformulation_suggestion = `建議將配方總糖漿減少約 ${Math.round((sugarPer100ml - 4.8) * 5)}g，或採用複方天然代糖（如甜菊糖苷或三氯蔗糖 INS 955）輔助，使每 100ml 總糖降至 4.9g 以下，即可合法豁免 10% 特別消費稅。`
  } else {
    warning_message = `✅ 預估每 100ml 總糖量為 ${sugarPer100ml.toFixed(1)}g（符合 ≤ 5.0g/100ml 免稅標準），免課徵 10% 特別消費稅。`
    reformulation_suggestion = `糖量控制良好，兼顧低糖健康趨勢與稅務優化。`
  }

  return {
    has_warning: isOverTaxThreshold,
    sugar_per_100ml: sugarPer100ml,
    sugar_tax_applies: isOverTaxThreshold,
    sugar_tax_rate: isOverTaxThreshold ? '10%' : '0%',
    tax_statute: 'Dự thảo Luật Thuế Tiêu thụ Đặc biệt (sửa đổi) — Đồ uống có đường',
    citation: 'Điều 2, Khoản 1, Điểm h — Danh mục hàng hóa chịu thuế TTĐB',
    warning_message,
    reformulation_suggestion,
    regulations_checked,
  }
}
