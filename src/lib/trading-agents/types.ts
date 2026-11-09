export type TradingAction = 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL'

export type AnalystRole = 'fundamentals' | 'technical' | 'news' | 'sentiment'
export type ResearcherRole = 'bull_researcher' | 'bear_researcher' | 'research_manager'
export type DecisionRole = 'trader' | 'risk_manager' | 'portfolio_manager'

export type AgentRole = AnalystRole | ResearcherRole | DecisionRole

export interface HistoricalBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalStats {
  rsi14: number
  sma20: number
  sma50: number
  sma200: number
  ema12: number
  ema26: number
  macdLine: number
  macdSignal: number
  macdHistogram: number
  bollingerUpper: number
  bollingerMiddle: number
  bollingerLower: number
  atr14: number
  supportLevel: number
  resistanceLevel: number
  trendSignal: 'Bullish' | 'Bearish' | 'Neutral'
}

export interface MarketDataSummary {
  ticker: string
  companyName: string
  exchange: string
  currency: string
  currentPrice: number
  changeAmount: number
  changePercent: number
  dayHigh: number
  dayLow: number
  volume: number
  avgVolume: number
  marketCap: number
  peRatio?: number
  eps?: number
  high52w: number
  low52w: number
  asOfDate: string
  historicalPrices: HistoricalBar[]
  technicals: TechnicalStats
  benchmark?: {
    ticker: string
    name: string
    changePercent: number
  }
}

export interface PositionHolding {
  ticker: string
  quantity: number
  averagePrice: number
}

export interface PortfolioContext {
  cash: number
  currency: string
  positions: PositionHolding[]
}

export interface AnalystReport {
  role: AnalystRole
  title: string
  analystName: string
  modelUsed: string
  summary: string
  score: number // -100 (Extremely Bearish) to +100 (Extremely Bullish)
  keyPoints: string[]
  details: string
  completedAt: string
}

export interface DebateStatement {
  round: number
  role: ResearcherRole
  speaker: string
  modelUsed: string
  content: string
  timestamp: string
}

export interface DebateSummary {
  rounds: number
  statements: DebateStatement[]
  bullProbability: number // 0 - 100
  bearProbability: number // 0 - 100
  consensusThesis: string
}

export type InvestmentHorizonMode = 'position_value' | 'swing_trend' | 'short_term'

export interface InvestmentHorizonOption {
  id: InvestmentHorizonMode
  title: string
  subtitle: string
  horizonLabel: string
  badgeLabel: string
  icon: string
  coreFocus: string
}

export const INVESTMENT_HORIZON_OPTIONS: InvestmentHorizonOption[] = [
  {
    id: 'position_value',
    title: '中長線價值投資 (Position & Value)',
    subtitle: '公允價值回歸·深厚商業護城河·金字塔分批建倉',
    horizonLabel: '3~12 個月 (中長線投資)',
    badgeLabel: '💎 中長線價值 (預設)',
    icon: 'Gem',
    coreFocus: '重視安全邊際、寬廣護城河與 12 大估值公允價，以投資論點失效為出場條件，無視短期市場雜訊',
  },
  {
    id: 'swing_trend',
    title: '中線波段趨勢 (Swing Trend)',
    subtitle: '季度財報催化·大波段週線多頭·景氣週期順勢',
    horizonLabel: '2~8 週 (波段交易)',
    badgeLabel: '🌊 中線波段',
    icon: 'Waves',
    coreFocus: '捕捉季度財報爆發、產業景氣催化劑與週線均線多頭波段，預設合理寬停損守護大趨勢',
  },
  {
    id: 'short_term',
    title: '短線動量波段 (Short-term Momentum)',
    subtitle: '關鍵價位突破·技術動能擺盪·高靈活快進快出',
    horizonLabel: '1~5 天 (短線波段)',
    badgeLabel: '⚡ 短線動量',
    icon: 'Zap',
    coreFocus: '依據短期支撐壓力、量價突破與即時消息快速操作，設置嚴格停損控管隔夜風險',
  },
]

export interface TraderProposal {
  action: TradingAction
  targetPrice: number
  stopLossPrice: number
  entryPriceRange: [number, number]
  riskRewardRatio: number
  recommendedAllocationPercent: number
  timeHorizon: 'Short-term (1-5 days)' | 'Swing (1-4 weeks)' | 'Medium-term (1-3 months)' | 'Long-term (6-12+ months)'
  investmentHorizonMode?: InvestmentHorizonMode
  stagingPlan?: string // 分批進場梯隊規劃
  invalidationThesis?: string // 投資論點失效停損條件
  rationale: string
}

export interface RiskAssessment {
  riskScore: number // 1 (Very Low) to 10 (Critical Extreme)
  volatilityRating: 'Low' | 'Moderate' | 'High' | 'Extreme'
  maxDrawdownEstimatePercent: number
  positionSizingCapPercent: number
  stressTestVerdict: 'Passed' | 'Caution' | 'Rejected'
  concerns: string[]
  hedgingRecommendations: string[]
  geopolitical?: import('./geopolitical').GeopoliticalProfile // 地緣政治 4 大實質傳導與壓力測試
}

export interface FinalDecision {
  action: TradingAction
  confidenceScore: number // 0 - 100%
  executionOrder: {
    ticker: string
    action: TradingAction
    orderType: 'LIMIT' | 'MARKET'
    limitPrice?: number
    targetPrice: number
    stopLossPrice: number
    quantity?: number
    suggestedAllocationPercent: number
  }
  executiveSummary: string
  keyCatalysts: string[]
  keyRisks: string[]
  holdingPeriodGuidance: string
  settled?: {
    isSettled: boolean
    settlePrice?: number
    settleDate?: string
    realizedReturnPercent?: number
    reflection?: string
  }
}

export interface TradingAgentsSession {
  id: string
  userId: string
  ticker: string
  analysisDate: string
  status: 'running' | 'completed' | 'failed'
  marketData: MarketDataSummary
  portfolio?: PortfolioContext
  valuationSuite?: import('./valuation-models').ValuationSuiteResult
  analysts: Record<AnalystRole, AnalystReport>
  debate: DebateSummary
  traderProposal?: TraderProposal
  riskAssessment?: RiskAssessment
  finalDecision?: FinalDecision
  fullReportHtml?: string
  createdAt: string
  completedAt?: string
}

export type TradingAgentsEvent =
  | { type: 'market-data'; data: MarketDataSummary }
  | { type: 'valuation-suite'; suite: import('./valuation-models').ValuationSuiteResult }
  | { type: 'phase'; phase: 'analysts' | 'debate' | 'trader' | 'risk' | 'portfolio_manager' | 'completed'; label: string }
  | { type: 'analyst-start'; role: AnalystRole; analystName: string; model: string }
  | { type: 'analyst-delta'; role: AnalystRole; chunk: string }
  | { type: 'analyst-end'; role: AnalystRole; report: AnalystReport }
  | { type: 'debate-round-start'; round: number }
  | { type: 'debate-speech-start'; round: number; role: ResearcherRole; speaker: string }
  | { type: 'debate-speech-delta'; round: number; role: ResearcherRole; chunk: string }
  | { type: 'debate-speech-end'; round: number; role: ResearcherRole; statement: DebateStatement }
  | { type: 'trader-start'; model: string }
  | { type: 'trader-delta'; chunk: string }
  | { type: 'trader-proposal'; proposal: TraderProposal }
  | { type: 'risk-start'; model: string }
  | { type: 'risk-delta'; chunk: string }
  | { type: 'risk-assessment'; assessment: RiskAssessment }
  | { type: 'manager-start'; model: string }
  | { type: 'manager-delta'; chunk: string }
  | { type: 'final-decision'; decision: FinalDecision; reportHtml: string }
  | { type: 'error'; message: string }
  | { type: 'done'; sessionId: string }
