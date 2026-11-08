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

export interface TraderProposal {
  action: TradingAction
  targetPrice: number
  stopLossPrice: number
  entryPriceRange: [number, number]
  riskRewardRatio: number
  recommendedAllocationPercent: number
  timeHorizon: 'Short-term (1-5 days)' | 'Swing (1-4 weeks)' | 'Medium-term (1-3 months)' | 'Long-term (6-12+ months)'
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
