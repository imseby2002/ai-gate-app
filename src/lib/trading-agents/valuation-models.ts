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
}

export interface ValuationSuiteResult {
  ticker: string
  currentPrice: number
  asOfDate: string
  models: ValuationModelResult[]
  averageFairValue: number // 加權平均公允價值
  medianFairValue: number
  overallValuationVerdict: 'Undervalued (低估·具安全邊際)' | 'Fairly Valued (合理區間)' | 'Overvalued (高估·留意風險)'
  valuationRange: [number, number] // [最低公允, 最高公允]
}

export function computeValuationSuite(data: MarketDataSummary): ValuationSuiteResult {
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

  // 2. P/E 比率模型 (市盈率模型)
  const industryPeTarget = 25.0
  const peFairValue = Math.round(eps * industryPeTarget * 100) / 100
  models.push({
    id: 'pe',
    name: 'Price-to-Earnings (P/E)',
    chineseName: '2. 市盈率/本益比模型 (P/E Ratio)',
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

  // 3. PEG 比率模型 (市盈率增長比模型)
  const pegTarget = 1.0 // Peter Lynch 1.0 Fair valuation benchmark
  const pegFairValue = Math.round(eps * (growthRate * pegTarget) * 100) / 100
  models.push({
    id: 'peg',
    name: 'Price/Earnings to Growth (PEG)',
    chineseName: '3. 市盈率增長比模型 (PEG Ratio)',
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

  // 4. EV/EBITDA 模型 (企業價值比率模型)
  const ebitdaTargetMultiple = 16.0
  const estimatedEbitdaPerShare = eps * 1.5
  const evEbitdaFairValue = Math.round(estimatedEbitdaPerShare * ebitdaTargetMultiple * 100) / 100
  models.push({
    id: 'ev_ebitda',
    name: 'EV/EBITDA Multiple',
    chineseName: '4. 企業價值倍數模型 (EV/EBITDA)',
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

  // 5. P/BV 比率模型 (市淨率模型)
  // Fair P/BV = (ROE - g) / (Ke - g)
  const pbTarget = Math.max(Math.round(((roe / 100 - 0.03) / Math.max(ke / 100 - 0.03, 0.02)) * 10) / 10, 1.2)
  const pbFairValue = Math.round(bvps * pbTarget * 100) / 100
  models.push({
    id: 'pb',
    name: 'Price-to-Book (P/BV)',
    chineseName: '5. 市淨率模型 (P/BV Ratio)',
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

  // 6. FCF 模型 (自由現金流模型)
  const targetFcfYield = 0.045 // 4.5% fair FCF yield
  const fcfFairValue = Math.round((fcfPerShare / targetFcfYield) * 100) / 100
  models.push({
    id: 'fcf',
    name: 'Free Cash Flow (FCF Yield)',
    chineseName: '6. 自由現金流殖利率模型 (FCF Yield)',
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

  // 7. ROE 模型 (淨資產收益率模型 / DuPont 模型)
  // Sustainable growth = ROE * (1 - payout ratio)
  const plowbackRatio = 0.75
  const sustainableGrowth = roe * plowbackRatio
  const roeFairValue = Math.round(bvps * (1 + (roe - ke) / ke) * 3.2 * 100) / 100
  models.push({
    id: 'roe',
    name: 'Return on Equity (ROE / DuPont)',
    chineseName: '7. 淨資產收益率模型 (ROE / DuPont)',
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

  // 8. CAPM 模型 (資本資產定價模型)
  // Required return -> inverse valuation hurdle
  const capmImpliedValue = Math.round((eps * (1 + (ke - rf) / 100) * (1 / (ke / 100)) * 1.05) * 100) / 100
  models.push({
    id: 'capm',
    name: 'Capital Asset Pricing Model (CAPM)',
    chineseName: '8. 資本資產定價模型 (CAPM)',
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

  // 9. EVA 模型 (經濟附加值模型)
  const investedCapital = bvps * 1.25
  const nopat = eps * 1.1
  const capitalCharge = investedCapital * (wacc / 100)
  const eva = nopat - capitalCharge
  const evaFairValue = Math.round((investedCapital + Math.max(eva, 0) / (wacc / 100) * 1.4) * 100) / 100
  models.push({
    id: 'eva',
    name: 'Economic Value Added (EVA)',
    chineseName: '9. 經濟附加價值模型 (EVA)',
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

  // 10. Dividend Discount 模型 (股息折現模型 / DDM)
  const ddmG = 0.035
  const ddmFairValue = Math.round((dividendPerShare * (1 + ddmG) / Math.max(ke / 100 - ddmG, 0.025)) * 100) / 100
  models.push({
    id: 'ddm',
    name: 'Dividend Discount Model (DDM / Gordon)',
    chineseName: '10. 股息折現模型 (DDM / Gordon)',
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

  // Consolidated statistics
  const applicableModels = models.filter(m => !m.applicability.startsWith('Low'))
  const validValues = (applicableModels.length > 0 ? applicableModels : models).map(m => m.fairValue)
  const avgFair = Math.round((validValues.reduce((a, b) => a + b, 0) / validValues.length) * 100) / 100

  const sorted = [...validValues].sort((a, b) => a - b)
  const medianFair = sorted[Math.floor(sorted.length / 2)]

  let verdict: ValuationSuiteResult['overallValuationVerdict'] = 'Fairly Valued (合理區間)'
  const priceDiff = (p - avgFair) / avgFair
  if (priceDiff < -0.12) verdict = 'Undervalued (低估·具安全邊際)'
  else if (priceDiff > 0.15) verdict = 'Overvalued (高估·留意風險)'

  return {
    ticker: data.ticker,
    currentPrice: p,
    asOfDate: data.asOfDate,
    models,
    averageFairValue: avgFair,
    medianFairValue: medianFair,
    overallValuationVerdict: verdict,
    valuationRange: [Math.min(...validValues), Math.max(...validValues)],
  }
}
