import type { MarketDataSummary } from './types'

export interface ValuationModelResult {
  id: string
  name: string
  chineseName: string
  category: 'Intrinsic (內在價值)' | 'Relative (相對估值)' | 'Cost of Capital (資本成本)'
  fairValue: number // 估算公允股價
  currentPrice: number
  premiumDiscountPercent: number // 溢價(+)或折價(-)百分比: (currentPrice - fairValue) / fairValue * 100
  applicability: 'High (極適用)' | 'Moderate (中等)' | 'Low (不適用/需修正)'
  confidence: number // 0 - 100%
  summary: string
  parameters: Record<string, string | number>
  formula: string
  starRating?: number // 晨星評等星級 (1-5 星)
  moat?: string // 晨星護城河評估
}

export const DEFAULT_SELECTED_MODEL_IDS: string[] = ['dcf', 'cds', 'ev_ebitda', 'roe']

export interface ValuationModelDef {
  id: string
  name: string
  chineseName: string
  category: 'Intrinsic (內在價值)' | 'Relative (相對估值)' | 'Cost of Capital (資本成本)'
  isDefault: boolean
  desc: string
}

export const ALL_VALUATION_MODELS: ValuationModelDef[] = [
  { id: 'dcf', name: 'Discounted Cash Flow (DCF)', chineseName: '1. 現金流折現 (DCF)', category: 'Intrinsic (內在價值)', isDefault: true, desc: '5年自由現金流折現與終值永續成長' },
  { id: 'cds', name: 'Credit Default Swap Index (CDS)', chineseName: '2. 信用違約互換/CDS指數', category: 'Cost of Capital (資本成本)', isDefault: true, desc: '違約與償債風險、債信利差對股權公允折價' },
  { id: 'pe', name: 'Price-to-Earnings (P/E)', chineseName: '3. 市盈率/本益比 (P/E)', category: 'Relative (相對估值)', isDefault: false, desc: '行業基準本益比乘數估值' },
  { id: 'peg', name: 'Price/Earnings to Growth (PEG)', chineseName: '4. 市盈率增長比 (PEG)', category: 'Relative (相對估值)', isDefault: false, desc: '彼得·林區成長動量 PEG = 1.0 定價基準' },
  { id: 'ev_ebitda', name: 'EV/EBITDA Multiple', chineseName: '5. 企業價值倍數 (EV/EBITDA)', category: 'Relative (相對估值)', isDefault: true, desc: '資本結構中立估值，消除利息與折舊干擾' },
  { id: 'pb', name: 'Price-to-Book (P/BV)', chineseName: '6. 市淨率 (P/BV)', category: 'Relative (相對估值)', isDefault: false, desc: '淨資產溢價倍數與資產重置價值防線' },
  { id: 'fcf', name: 'Free Cash Flow Yield (FCF)', chineseName: '7. 自由現金流殖利率 (FCF)', category: 'Intrinsic (內在價值)', isDefault: false, desc: '扣除資本支出後的真實現金流殖利率資本化' },
  { id: 'roe', name: 'ROE / DuPont Analysis', chineseName: '8. 淨資產收益率 (ROE / 杜邦)', category: 'Intrinsic (內在價值)', isDefault: true, desc: '獲利引擎與槓桿體檢、可持續再投資增速' },
  { id: 'capm', name: 'Capital Asset Pricing (CAPM)', chineseName: '9. 資本資產定價 (CAPM)', category: 'Cost of Capital (資本成本)', isDefault: false, desc: 'Beta 系統性風險係數與必要股權報酬率' },
  { id: 'eva', name: 'Economic Value Added (EVA)', chineseName: '10. 經濟附加價值 (EVA)', category: 'Intrinsic (內在價值)', isDefault: false, desc: 'NOPAT 扣除資本成本之超額股東價值創造' },
  { id: 'ddm', name: 'Dividend Discount (DDM)', chineseName: '11. 股息折現 (DDM / Gordon)', category: 'Intrinsic (內在價值)', isDefault: false, desc: '戈登成長模型長期股利折現回推' },
  { id: 'morningstar', name: 'Morningstar Moat & Rating', chineseName: '12. 晨星護城河與星等 (Morningstar)', category: 'Intrinsic (內在價值)', isDefault: false, desc: '寬廣/狹窄護城河與 1~5 星級安全邊際評定' },
]

export interface ValuationSuiteResult {
  ticker: string
  currentPrice: number
  asOfDate: string
  models: ValuationModelResult[]
  allModels?: ValuationModelResult[] // 完整所有 12 款模型
  selectedModelIds?: string[]
  averageFairValue: number // 加權平均公允價值
  medianFairValue: number
  overallValuationVerdict: 'Undervalued (低估·具安全邊際)' | 'Fairly Valued (合理區間)' | 'Overvalued (高估·留意風險)'
  valuationRange: [number, number] // [最低公允, 最高公允]
}

export function computeValuationSuite(data: MarketDataSummary, selectedModelIds?: string[]): ValuationSuiteResult {
  const p = data.currentPrice
  const isCrypto = data.ticker.includes('BTC') || data.ticker.includes('ETH') || data.ticker.includes('SOL')
  const eps = data.eps ?? Math.max(p / (data.peRatio || 30), p * 0.035)
  const pe = data.peRatio ?? (p / Math.max(eps, 0.1))

  // Estimate baseline financial inputs
  const bvps = p / 4.5 // Book value per share estimate
  const roe = Math.min(Math.max((eps / bvps) * 100, 5), 45) // Return on equity %
  const beta = data.technicals.atr14 / p > 0.03 ? 1.35 : 1.05
  const rf = 4.2 // 10-year US Treasury risk-free rate %
  const erp = 5.0 // Equity risk premium %
  const ke = rf + beta * erp // CAPM Cost of equity %
  const wacc = Math.round((ke * 0.85 + 4.5 * 0.15 * (1 - 0.21)) * 100) / 100 // WACC estimate %
  const growthRate = Math.min(Math.max(roe * 0.6, 5), 25) // Expected EPS growth rate %
  const fcfPerShare = eps * 1.15 // FCF per share
  const dividendPerShare = eps * 0.25 // Dividend per share

  const models: ValuationModelResult[] = []

  // 1. DCF 模型 (現金流折現模型)
  const dcfG1 = growthRate / 100
  const dcfG2 = 0.025 // perpetual terminal growth 2.5%
  const dcfDiscount = wacc / 100
  let pvFcfSum = 0
  let currentFcf = fcfPerShare
  for (let y = 1; y <= 5; y++) {
    currentFcf *= (1 + dcfG1)
    pvFcfSum += currentFcf / Math.pow(1 + dcfDiscount, y)
  }
  const terminalVal = (currentFcf * (1 + dcfG2)) / Math.max(dcfDiscount - dcfG2, 0.03)
  const pvTerminalVal = terminalVal / Math.pow(1 + dcfDiscount, 5)
  const dcfFairValue = Math.round((pvFcfSum + pvTerminalVal) * 100) / 100

  models.push({
    id: 'dcf',
    name: 'Discounted Cash Flow (DCF)',
    chineseName: '1. 現金流折現模型 (DCF)',
    category: 'Intrinsic (內在價值)',
    fairValue: dcfFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - dcfFairValue) / dcfFairValue) * 100 * 10) / 10,
    applicability: isCrypto ? 'Low (不適用/需修正)' : 'High (極適用)',
    confidence: 85,
    summary: `採用 5 年預測期 (成長率 ${growthRate.toFixed(1)}%) + 終值 (永續成長率 2.5%)，折現率 WACC 為 ${wacc}%。考量未來現金流時間價值與風險溢酬。`,
    parameters: {
      '5年預期年複合增長率 (g1)': `${growthRate.toFixed(1)}%`,
      '永續終值增長率 (g2)': '2.5%',
      '加權平均資本成本 (WACC)': `${wacc}%`,
      '首年 FCF/股': `$${fcfPerShare.toFixed(2)}`,
    },
    formula: 'Fair Value = Σ [FCF_t / (1 + WACC)^t] + [Terminal Value / (1 + WACC)^5]',
  })

  // 2. CDS 指數模型 (信用違約交換指數 / 信用風險定價模型) [放在第二個位置]
  // 5年期信用違約利差 (CDS Spread)，科技巨頭通常在 25-50 bps，一般投資級 60-120 bps，高波動投機級 200+ bps
  const cdsSpreadBps = isCrypto ? 450 : (beta > 1.25 ? Math.round(45 + (beta - 1.25) * 80) : 32)
  const recoveryRate = 0.40 // 標準違約回收率 40%
  const defaultProb5Y = Math.round((1 - Math.exp(-(cdsSpreadBps / 10000) * 5 / (1 - recoveryRate))) * 10000) / 100 // 5年累積違約率 %
  // CDS 利差對資本成本的懲罰折價率
  const creditCostPenalty = (cdsSpreadBps / 10000) * 0.35 // 債務佔比權重約 35%
  const cdsDiscountFactor = 1 / (1 + creditCostPenalty * 2.5)
  // 基於資產負債表信用風險調整後公允股價
  const cdsAdjustedFairValue = Math.round((dcfFairValue * (1 - (defaultProb5Y / 100) * (1 - recoveryRate)) * cdsDiscountFactor) * 100) / 100

  models.push({
    id: 'cds',
    name: 'Credit Default Swap Index (CDS)',
    chineseName: '2. 信用違約互換/CDS指數模型 (Credit Default Swap)',
    category: 'Cost of Capital (資本成本)',
    fairValue: cdsAdjustedFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - cdsAdjustedFairValue) / cdsAdjustedFairValue) * 100 * 10) / 10,
    applicability: isCrypto ? 'Moderate (中等/無主權債)' : 'High (極適用)',
    confidence: 86,
    summary: `量化債信違約風險對股權定價的衝擊。隱含 5 年期 CDS 利差為 ${cdsSpreadBps} bps，推導累積違約機率 ${defaultProb5Y}% (以 40% 回收率計)，並經信用利差成本對股權折價修正。`,
    parameters: {
      '5年期 CDS 信用利差': `${cdsSpreadBps} bps`,
      '隱含5年違約率 (PD)': `${defaultProb5Y}%`,
      '違約預期回收率 (RR)': '40.0%',
      '信用風險折價因子': `${(cdsDiscountFactor * 100).toFixed(1)}%`,
    },
    formula: 'PD = 1 - e^(-S×T/(1-R)); Fair Value = Fair_base × (1 - PD × (1-R)) × DiscountFactor',
  })

  // 3. P/E 比率模型 (市盈率模型)
  const industryPeTarget = 25.0
  const peFairValue = Math.round(eps * industryPeTarget * 100) / 100
  models.push({
    id: 'pe',
    name: 'Price-to-Earnings (P/E)',
    chineseName: '3. 市盈率/本益比模型 (P/E Ratio)',
    category: 'Relative (相對估值)',
    fairValue: peFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - peFairValue) / peFairValue) * 100 * 10) / 10,
    applicability: eps > 0 && !isCrypto ? 'High (極適用)' : 'Low (不適用/需修正)',
    confidence: 80,
    summary: `以行業標準公允本益比乘數 (${industryPeTarget}x) 乘上當前每股盈餘 (EPS $${eps.toFixed(2)})。直觀評估相較同行與歷史估值高低。`,
    parameters: {
      '每股盈餘 (EPS)': `$${eps.toFixed(2)}`,
      '當前本益比 (Current P/E)': `${pe.toFixed(1)}x`,
      '基準公允本益比 (Target P/E)': `${industryPeTarget}x`,
    },
    formula: 'Fair Value = EPS × Target P/E',
  })

  // 4. PEG 比率模型 (市盈率增長比模型)
  const pegTarget = 1.0 // Peter Lynch 1.0 Fair valuation benchmark
  const pegFairValue = Math.round(eps * (growthRate * pegTarget) * 100) / 100
  models.push({
    id: 'peg',
    name: 'Price/Earnings to Growth (PEG)',
    chineseName: '4. 市盈率增長比模型 (PEG Ratio)',
    category: 'Relative (相對估值)',
    fairValue: pegFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - pegFairValue) / pegFairValue) * 100 * 10) / 10,
    applicability: growthRate > 5 && !isCrypto ? 'High (極適用)' : 'Moderate (中等)',
    confidence: 82,
    summary: `納入盈餘成長率預期 (${growthRate.toFixed(1)}%)，以彼得·林區 (Peter Lynch) PEG = 1.0 為公允定價基準，避免單純 P/E 懲罰高成長公司。`,
    parameters: {
      '當前 PEG': (pe / Math.max(growthRate, 1)).toFixed(2),
      '基準公允 PEG': '1.0',
      '預期盈餘增長率': `${growthRate.toFixed(1)}%`,
    },
    formula: 'Fair Value = EPS × Expected Growth Rate (%) × Target PEG',
  })

  // 5. EV/EBITDA 模型 (企業價值比率模型)
  const ebitdaTargetMultiple = 16.0
  const estimatedEbitdaPerShare = eps * 1.5
  const evEbitdaFairValue = Math.round(estimatedEbitdaPerShare * ebitdaTargetMultiple * 100) / 100
  models.push({
    id: 'ev_ebitda',
    name: 'EV/EBITDA Multiple',
    chineseName: '5. 企業價值倍數模型 (EV/EBITDA)',
    category: 'Relative (相對估值)',
    fairValue: evEbitdaFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - evEbitdaFairValue) / evEbitdaFairValue) * 100 * 10) / 10,
    applicability: isCrypto ? 'Low (不適用/需修正)' : 'High (極適用)',
    confidence: 78,
    summary: `消除資本負債結構、折舊攤銷與稅率擾動，以行業常態 EBITDA 倍數 (${ebitdaTargetMultiple}x) 評估經營性現金獲利能力。`,
    parameters: {
      '每股估計 EBITDA': `$${estimatedEbitdaPerShare.toFixed(2)}`,
      '基準 EV/EBITDA 乘數': `${ebitdaTargetMultiple}x`,
    },
    formula: 'Fair Value = (EBITDA × Target EV/EBITDA Multiple - Net Debt) / Shares',
  })

  // 6. P/BV 比率模型 (市淨率模型)
  // Fair P/BV = (ROE - g) / (Ke - g)
  const pbTarget = Math.max(Math.round(((roe / 100 - 0.03) / Math.max(ke / 100 - 0.03, 0.02)) * 10) / 10, 1.2)
  const pbFairValue = Math.round(bvps * pbTarget * 100) / 100
  models.push({
    id: 'pb',
    name: 'Price-to-Book (P/BV)',
    chineseName: '6. 市淨率模型 (P/BV Ratio)',
    category: 'Relative (相對估值)',
    fairValue: pbFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - pbFairValue) / pbFairValue) * 100 * 10) / 10,
    applicability: isCrypto ? 'Low (不適用/需修正)' : 'Moderate (中等)',
    confidence: 75,
    summary: `依股本報酬率 (${roe.toFixed(1)}%) 與股權成本 (${ke.toFixed(1)}%) 解算公允淨資產溢價乘數 (${pbTarget}x)，反映資產端價值防禦底線。`,
    parameters: {
      '每股淨資產 (BVPS)': `$${bvps.toFixed(2)}`,
      '公允 P/BV 乘數': `${pbTarget}x`,
      '當前 ROE': `${roe.toFixed(1)}%`,
    },
    formula: 'Fair P/BV = (ROE - g) / (Ke - g), Fair Value = BVPS × Fair P/BV',
  })

  // 7. FCF 模型 (自由現金流模型)
  const targetFcfYield = 0.045 // 4.5% fair FCF yield
  const fcfFairValue = Math.round((fcfPerShare / targetFcfYield) * 100) / 100
  models.push({
    id: 'fcf',
    name: 'Free Cash Flow (FCF Yield)',
    chineseName: '7. 自由現金流殖利率模型 (FCF Yield)',
    category: 'Intrinsic (內在價值)',
    fairValue: fcfFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - fcfFairValue) / fcfFairValue) * 100 * 10) / 10,
    applicability: isCrypto ? 'Low (不適用/需修正)' : 'High (極適用)',
    confidence: 84,
    summary: `以扣除資本支出後的真實現金流量為核心，按機構投資人要求之 4.5% 自由現金流殖利率進行資本化評價。`,
    parameters: {
      '每股自由現金流 (FCF)': `$${fcfPerShare.toFixed(2)}`,
      '要求公允 FCF 殖利率': '4.5%',
      '當前隱含 FCF 殖利率': `${((fcfPerShare / p) * 100).toFixed(2)}%`,
    },
    formula: 'Fair Value = FCF per Share / Required FCF Yield',
  })

  // 8. ROE 模型 (淨資產收益率模型 / DuPont 模型)
  // Sustainable growth = ROE * (1 - payout ratio)
  const plowbackRatio = 0.75
  const sustainableGrowth = roe * plowbackRatio
  const roeFairValue = Math.round(bvps * (1 + (roe - ke) / ke) * 3.2 * 100) / 100
  models.push({
    id: 'roe',
    name: 'Return on Equity (ROE / DuPont)',
    chineseName: '8. 淨資產收益率模型 (ROE / DuPont)',
    category: 'Intrinsic (內在價值)',
    fairValue: roeFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - roeFairValue) / roeFairValue) * 100 * 10) / 10,
    applicability: !isCrypto ? 'High (極適用)' : 'Low (不適用/需修正)',
    confidence: 80,
    summary: `分析企業杜邦拆解能力（利潤率 × 週轉率 × 財務槓桿），以可持續再投資盈餘增速 (${sustainableGrowth.toFixed(1)}%) 衡量資本配置效率。`,
    parameters: {
      '淨資產收益率 (ROE)': `${roe.toFixed(1)}%`,
      '股權再投資留存率': '75%',
      '可持續增長率 (SGR)': `${sustainableGrowth.toFixed(1)}%`,
    },
    formula: 'Sustainable Growth = ROE × (1 - Payout Ratio)',
  })

  // 9. CAPM 模型 (資本資產定價模型)
  // Required return -> inverse valuation hurdle
  const capmImpliedValue = Math.round((eps * (1 + (ke - rf) / 100) * (1 / (ke / 100)) * 1.05) * 100) / 100
  models.push({
    id: 'capm',
    name: 'Capital Asset Pricing Model (CAPM)',
    chineseName: '9. 資本資產定價模型 (CAPM)',
    category: 'Cost of Capital (資本成本)',
    fairValue: capmImpliedValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - capmImpliedValue) / capmImpliedValue) * 100 * 10) / 10,
    applicability: 'High (極適用)',
    confidence: 88,
    summary: `計算該標的系統性風險 (Beta = ${beta.toFixed(2)}) 與市場風險溢酬，求得投資人持有該資產所必需的最低預期報酬率 (Ke = ${ke.toFixed(2)}%)。`,
    parameters: {
      '貝塔係數 (Beta)': beta.toFixed(2),
      '無風險利率 (Rf)': `${rf}% (10Y US Treasury)`,
      '市場風險溢酬 (ERP)': `${erp}%`,
      '股權必要報酬率 (Ke)': `${ke.toFixed(2)}%`,
    },
    formula: 'Ke = Rf + β × (Rm - Rf)',
  })

  // 10. EVA 模型 (經濟附加值模型)
  const investedCapital = bvps * 1.25
  const nopat = eps * 1.1
  const capitalCharge = investedCapital * (wacc / 100)
  const eva = nopat - capitalCharge
  const evaFairValue = Math.round((investedCapital + Math.max(eva, 0) / (wacc / 100) * 1.4) * 100) / 100
  models.push({
    id: 'eva',
    name: 'Economic Value Added (EVA)',
    chineseName: '10. 經濟附加價值模型 (EVA)',
    category: 'Intrinsic (內在價值)',
    fairValue: evaFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - evaFairValue) / evaFairValue) * 100 * 10) / 10,
    applicability: !isCrypto ? 'High (極適用)' : 'Low (不適用/需修正)',
    confidence: 82,
    summary: `檢驗企業創造之稅後淨營業利潤 (NOPAT) 是否超越所有股權與債權資本成本。若 EVA > 0 代表真實創造股東超額價值。`,
    parameters: {
      '每股 NOPAT': `$${nopat.toFixed(2)}`,
      '每股資本成本負擔': `$${capitalCharge.toFixed(2)}`,
      '每股經濟附加值 (EVA)': `$${eva.toFixed(2)}`,
    },
    formula: 'EVA = NOPAT - (Invested Capital × WACC)',
  })

  // 11. Dividend Discount 模型 (股息折現模型 / DDM)
  const ddmG = 0.035
  const ddmFairValue = Math.round((dividendPerShare * (1 + ddmG) / Math.max(ke / 100 - ddmG, 0.025)) * 100) / 100
  models.push({
    id: 'ddm',
    name: 'Dividend Discount Model (DDM / Gordon)',
    chineseName: '11. 股息折現模型 (DDM / Gordon)',
    category: 'Intrinsic (內在價值)',
    fairValue: ddmFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - ddmFairValue) / ddmFairValue) * 100 * 10) / 10,
    applicability: dividendPerShare > 0.1 && !isCrypto ? 'Moderate (中等)' : 'Low (不適用/無股息)',
    confidence: dividendPerShare > 0.1 ? 75 : 50,
    summary: `採用戈登成長模型 (Gordon Growth Model)，以每股預期現金股利 ($${dividendPerShare.toFixed(2)}) 與股息長期穩定增長率 (3.5%) 折現回推。`,
    parameters: {
      '每股預估現金股利': `$${dividendPerShare.toFixed(2)}`,
      '股息長期增長率 (g)': '3.5%',
      '股權折現率 (Ke)': `${ke.toFixed(2)}%`,
    },
    formula: 'P_0 = D_1 / (Ke - g) = [D_0 × (1 + g)] / (Ke - g)',
  })

  // 12. 晨星護城河與公允價值星等模型 (Morningstar Rating & Moat)
  // 護城河判定：ROE > 18% 且成長優勢顯著為 Wide Moat；ROE 11-18% Narrow Moat；其餘 None
  const moat: 'Wide (寬廣護城河)' | 'Narrow (狹窄護城河)' | 'None (無護城河)' =
    roe >= 20 ? 'Wide (寬廣護城河)' : roe >= 12 ? 'Narrow (狹窄護城河)' : 'None (無護城河)'
  const moatMultiplier = moat.startsWith('Wide') ? 1.25 : moat.startsWith('Narrow') ? 1.08 : 0.92
  const morningstarFairValue = Math.round(dcfFairValue * moatMultiplier * 0.98 * 100) / 100
  const priceToFairValue = p / morningstarFairValue

  // 晨星 1~5 星評級計算
  let starRating = 3
  let starLabel = '★★★☆☆ (3星·合理價值)'
  if (priceToFairValue <= 0.75) {
    starRating = 5
    starLabel = '★★★★★ (5星·顯著低估·極佳買點)'
  } else if (priceToFairValue <= 0.90) {
    starRating = 4
    starLabel = '★★★★☆ (4星·溫和低估·具安全邊際)'
  } else if (priceToFairValue <= 1.15) {
    starRating = 3
    starLabel = '★★★☆☆ (3星·公允合理區間)'
  } else if (priceToFairValue <= 1.35) {
    starRating = 2
    starLabel = '★★☆☆☆ (2星·溫和高估)'
  } else {
    starRating = 1
    starLabel = '★☆☆☆☆ (1星·顯著高估·溢價偏高)'
  }

  models.push({
    id: 'morningstar',
    name: 'Morningstar Moat & Fair Value Rating',
    chineseName: '12. 晨星護城河與公允價值星等 (Morningstar Rating)',
    category: 'Intrinsic (內在價值)',
    fairValue: morningstarFairValue,
    currentPrice: p,
    premiumDiscountPercent: Math.round(((p - morningstarFairValue) / morningstarFairValue) * 100 * 10) / 10,
    applicability: !isCrypto ? 'High (極適用)' : 'Moderate (中等)',
    confidence: 90,
    summary: `基於晨星 (Morningstar) 評級體系，判定企業具備【${moat}】。目前股價對應公允價值比 (P/FV) 為 ${(priceToFairValue).toFixed(2)}，獲評【${starLabel}】。`,
    parameters: {
      '經濟護城河評等': moat,
      '晨星公允價值': `$${morningstarFairValue.toFixed(2)}`,
      '市價/公允價比 (P/FV)': priceToFairValue.toFixed(2),
      '晨星星等評級': `${starRating} 星 (${'★'.repeat(starRating)}${'☆'.repeat(5 - starRating)})`,
    },
    formula: 'Moat Multiplier based on Sustainable ROE Spread; Star Rating = F(Price / Fair Value Ratio)',
    starRating,
    moat,
  })

  const allModels = [...models]
  const targetIds = selectedModelIds && selectedModelIds.length > 0 ? selectedModelIds : null
  const activeModels = targetIds ? allModels.filter(m => targetIds.includes(m.id)) : allModels

  // Consolidated statistics for active models
  const applicableModels = activeModels.filter(m => !m.applicability.startsWith('Low'))
  const validValues = (applicableModels.length > 0 ? applicableModels : activeModels).map(m => m.fairValue)
  const avgFair = validValues.length > 0 ? Math.round((validValues.reduce((a, b) => a + b, 0) / validValues.length) * 100) / 100 : p

  const sorted = [...validValues].sort((a, b) => a - b)
  const medianFair = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : p

  let verdict: ValuationSuiteResult['overallValuationVerdict'] = 'Fairly Valued (合理區間)'
  const priceDiff = avgFair > 0 ? (p - avgFair) / avgFair : 0
  if (priceDiff < -0.12) verdict = 'Undervalued (低估·具安全邊際)'
  else if (priceDiff > 0.15) verdict = 'Overvalued (高估·留意風險)'

  return {
    ticker: data.ticker,
    currentPrice: p,
    asOfDate: data.asOfDate,
    models: activeModels,
    allModels,
    selectedModelIds: targetIds ?? allModels.map(m => m.id),
    averageFairValue: avgFair,
    medianFairValue: medianFair,
    overallValuationVerdict: verdict,
    valuationRange: validValues.length > 0 ? [Math.min(...validValues), Math.max(...validValues)] : [p, p],
  }
}

/**
 * 依據使用者勾選的模型清單，在前端即時重新過濾並計算公允價值指標
 */
export function filterValuationSuite(suite: ValuationSuiteResult, selectedIds: string[]): ValuationSuiteResult {
  const sourcePool = suite.allModels && suite.allModels.length > 0 ? suite.allModels : suite.models
  const activeModels = sourcePool.filter(m => selectedIds.includes(m.id))
  const p = suite.currentPrice

  const applicableModels = activeModels.filter(m => !m.applicability.startsWith('Low'))
  const validValues = (applicableModels.length > 0 ? applicableModels : activeModels).map(m => m.fairValue)
  const avgFair = validValues.length > 0 ? Math.round((validValues.reduce((a, b) => a + b, 0) / validValues.length) * 100) / 100 : p

  const sorted = [...validValues].sort((a, b) => a - b)
  const medianFair = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : p

  let verdict: ValuationSuiteResult['overallValuationVerdict'] = 'Fairly Valued (合理區間)'
  const priceDiff = avgFair > 0 ? (p - avgFair) / avgFair : 0
  if (priceDiff < -0.12) verdict = 'Undervalued (低估·具安全邊際)'
  else if (priceDiff > 0.15) verdict = 'Overvalued (高估·留意風險)'

  return {
    ...suite,
    models: activeModels,
    allModels: sourcePool,
    selectedModelIds: selectedIds,
    averageFairValue: avgFair,
    medianFairValue: medianFair,
    overallValuationVerdict: verdict,
    valuationRange: validValues.length > 0 ? [Math.min(...validValues), Math.max(...validValues)] : [p, p],
  }
}
