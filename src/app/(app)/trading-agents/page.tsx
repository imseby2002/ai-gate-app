'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  Search,
  Sparkles,
  Briefcase,
  History,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Users,
  ShieldCheck,
  Target,
  BarChart3,
  Flame,
} from 'lucide-react'
import type {
  MarketDataSummary,
  AnalystRole,
  AnalystReport,
  DebateStatement,
  DebateSummary,
  TraderProposal,
  RiskAssessment,
  FinalDecision,
  PortfolioContext,
  TradingAgentsEvent,
} from '@/lib/trading-agents/types'
import { MarketHeader } from '@/components/trading-agents/MarketHeader'
import { PortfolioModal } from '@/components/trading-agents/PortfolioModal'
import { DecisionVerdictCard } from '@/components/trading-agents/DecisionVerdictCard'
import { AgentStreamCard } from '@/components/trading-agents/AgentStreamCard'
import { HistoryDrawer } from '@/components/trading-agents/HistoryDrawer'

const POPULAR_TICKERS = [
  { symbol: 'NVDA', label: '輝達 (NVIDIA)' },
  { symbol: 'TSLA', label: '特斯拉 (Tesla)' },
  { symbol: 'AAPL', label: '蘋果 (Apple)' },
  { symbol: 'MSFT', label: '微軟 (Microsoft)' },
  { symbol: '2330.TW', label: '台積電 (TSMC)' },
  { symbol: '0050.TW', label: '元大台灣50' },
  { symbol: 'BTC-USD', label: '比特幣 (Bitcoin)' },
  { symbol: 'ETH-USD', label: '以太幣 (Ethereum)' },
]

export default function TradingAgentsPage() {
  const [tickerInput, setTickerInput] = useState('NVDA')
  const [activeTicker, setActiveTicker] = useState('NVDA')
  const [marketData, setMarketData] = useState<MarketDataSummary | null>(null)
  const [loadingMarket, setLoadingMarket] = useState(false)
  const [running, setRunning] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<string>('idle')
  const [phaseLabel, setPhaseLabel] = useState<string>('')

  // Settings
  const [debateRounds, setDebateRounds] = useState(1)
  const [quickModel, setQuickModel] = useState('google/gemini-2.5-flash')
  const [deepModel, setDeepModel] = useState('anthropic/claude-sonnet-4-6')
  const [portfolio, setPortfolio] = useState<PortfolioContext>({
    cash: 25000,
    currency: 'USD',
    positions: [],
  })

  // Modals
  const [portfolioOpen, setPortfolioOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Streaming State
  const [analystsStreaming, setAnalystsStreaming] = useState<Record<AnalystRole, { content: string; isStreaming: boolean; isDone: boolean; report?: AnalystReport }>>({
    fundamentals: { content: '', isStreaming: false, isDone: false },
    technical: { content: '', isStreaming: false, isDone: false },
    news: { content: '', isStreaming: false, isDone: false },
    sentiment: { content: '', isStreaming: false, isDone: false },
  })

  const [debateStatements, setDebateStatements] = useState<DebateStatement[]>([])
  const [currentDebateChunk, setCurrentDebateChunk] = useState<{ role?: string; speaker?: string; text: string }>({ text: '' })
  const [traderProposal, setTraderProposal] = useState<TraderProposal | null>(null)
  const [traderText, setTraderText] = useState('')
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null)
  const [riskText, setRiskText] = useState('')
  const [finalDecision, setFinalDecision] = useState<FinalDecision | null>(null)
  const [fullReportHtml, setFullReportHtml] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch quick quote on ticker selection
  const fetchQuote = async (ticker: string) => {
    setLoadingMarket(true)
    try {
      const res = await fetch(`/api/trading-agents/market-data?ticker=${encodeURIComponent(ticker)}`)
      if (res.ok) {
        const data = await res.json()
        setMarketData(data)
        setActiveTicker(ticker)
      }
    } catch (err) {
      console.warn('[TradingAgents] failed to load quote:', err)
    } finally {
      setLoadingMarket(false)
    }
  }

  useEffect(() => {
    fetchQuote('NVDA')
  }, [])

  const handleStartAnalysis = async () => {
    if (running) return

    setRunning(true)
    setErrorMessage(null)
    setFinalDecision(null)
    setFullReportHtml(null)
    setSessionId(null)
    setTraderProposal(null)
    setTraderText('')
    setRiskAssessment(null)
    setRiskText('')
    setDebateStatements([])
    setCurrentDebateChunk({ text: '' })

    // Reset analysts
    setAnalystsStreaming({
      fundamentals: { content: '', isStreaming: true, isDone: false },
      technical: { content: '', isStreaming: true, isDone: false },
      news: { content: '', isStreaming: true, isDone: false },
      sentiment: { content: '', isStreaming: true, isDone: false },
    })

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/trading-agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: activeTicker,
          portfolio,
          config: {
            debateRounds,
            modelConfig: {
              quickThinkModel: quickModel,
              deepThinkModel: deepModel,
            },
          },
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`HTTP ${res.status}: ${err}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('ReadableStream not supported')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const dataStr = trimmed.slice(5).trim()
          if (dataStr === '[DONE]') break

          try {
            const event: TradingAgentsEvent = JSON.parse(dataStr)
            handleEvent(event)
          } catch {
            // ignore partial JSON parse error
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[TradingAgents] run error:', err)
        setErrorMessage(err.message || '執行分析時發生錯誤')
      }
    } finally {
      setRunning(false)
    }
  }

  const handleEvent = (event: TradingAgentsEvent) => {
    switch (event.type) {
      case 'market-data':
        setMarketData(event.data)
        break
      case 'phase':
        setCurrentPhase(event.phase)
        setPhaseLabel(event.label)
        break
      case 'analyst-start':
        setAnalystsStreaming(prev => ({
          ...prev,
          [event.role]: { ...prev[event.role], isStreaming: true, isDone: false },
        }))
        break
      case 'analyst-delta':
        setAnalystsStreaming(prev => ({
          ...prev,
          [event.role]: {
            ...prev[event.role],
            content: prev[event.role].content + event.chunk,
            isStreaming: true,
          },
        }))
        break
      case 'analyst-end':
        setAnalystsStreaming(prev => ({
          ...prev,
          [event.role]: {
            ...prev[event.role],
            isStreaming: false,
            isDone: true,
            report: event.report,
          },
        }))
        break
      case 'debate-speech-start':
        setCurrentDebateChunk({ role: event.role, speaker: event.speaker, text: '' })
        break
      case 'debate-speech-delta':
        setCurrentDebateChunk(prev => ({ ...prev, text: prev.text + event.chunk }))
        break
      case 'debate-speech-end':
        setDebateStatements(prev => [...prev, event.statement])
        setCurrentDebateChunk({ text: '' })
        break
      case 'trader-delta':
        setTraderText(prev => prev + event.chunk)
        break
      case 'trader-proposal':
        setTraderProposal(event.proposal)
        break
      case 'risk-delta':
        setRiskText(prev => prev + event.chunk)
        break
      case 'risk-assessment':
        setRiskAssessment(event.assessment)
        break
      case 'final-decision':
        setFinalDecision(event.decision)
        setFullReportHtml(event.reportHtml)
        break
      case 'done':
        setSessionId(event.sessionId)
        break
      case 'error':
        setErrorMessage(event.message)
        break
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-violet-500/10 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30 uppercase tracking-wider">
                  TauricResearch · TradingAgents Framework
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <TrendingUp className="h-7 w-7 text-primary" />
                TradingAgents 多 Agent 智慧金融交易框架
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
                模擬頂級對沖基金架構：四大獨立分析師平行研判、多空首席研究員激烈辯論、量化交易員執行計畫、風控團隊極限壓力測試與基金經理人終局裁決。
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPortfolioOpen(true)}
                className="text-xs h-9"
              >
                <Briefcase className="h-3.5 w-3.5 mr-1.5 text-primary" />
                投資組合設定 ({portfolio.currency} ${portfolio.cash.toLocaleString()})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                className="text-xs h-9"
              >
                <History className="h-3.5 w-3.5 mr-1.5" />
                歷史決策紀錄
              </Button>
            </div>
          </div>
        </div>

        {/* Ticker Search & Presets Bar */}
        <Card className="p-4 border-border/80 shadow-sm rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    fetchQuote(tickerInput)
                  }
                }}
                placeholder="輸入美股、台股、加密貨幣代號 (例如: NVDA, 2330.TW, BTC-USD)"
                className="pl-9 font-mono font-bold uppercase text-sm h-10"
              />
            </div>

            <Button
              onClick={() => fetchQuote(tickerInput)}
              disabled={loadingMarket}
              className="h-10 px-5 text-xs font-semibold"
            >
              {loadingMarket ? '載入行情中...' : '載入盤勢'}
            </Button>

            <Button
              onClick={handleStartAnalysis}
              disabled={running || loadingMarket || !marketData}
              className="h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shrink-0"
            >
              <Play className="h-4 w-4 mr-1.5 fill-current" />
              {running ? 'Agent 團隊研判中...' : '啟動 TradingAgents 決策流'}
            </Button>
          </div>

          {/* Quick preset pills */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 text-xs text-muted-foreground">
            <span className="shrink-0 flex items-center gap-1 font-medium">
              <Flame className="h-3.5 w-3.5 text-amber-500" /> 熱門標的：
            </span>
            {POPULAR_TICKERS.map(item => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  setTickerInput(item.symbol)
                  fetchQuote(item.symbol)
                }}
                className={`px-2.5 py-1 rounded-md transition-all shrink-0 cursor-pointer text-xs font-mono font-medium ${
                  activeTicker === item.symbol
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'bg-muted hover:bg-accent text-foreground'
                }`}
              >
                {item.symbol}
                <span className="hidden sm:inline opacity-70 ml-1">({item.label.split(' ')[0]})</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Live Market Header */}
        {marketData && <MarketHeader data={marketData} />}

        {/* Phase Progress Indicator */}
        {running && (
          <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3 animate-pulse">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-primary">
                TradingAgents 執行狀態 · {currentPhase}
              </div>
              <div className="text-sm font-semibold text-foreground">
                {phaseLabel || '多 Agent 團隊協同運作中...'}
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Final Decision Verdict (When completed) */}
        {finalDecision && marketData && (
          <DecisionVerdictCard
            decision={finalDecision}
            marketData={marketData}
            sessionId={sessionId || undefined}
            reportHtml={fullReportHtml || undefined}
          />
        )}

        {/* Phase 1: Analyst Team Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              1. 四大專業分析師獨立研判團隊 (Analyst Team · Parallel Stream)
            </h3>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              平行併發處理
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AgentStreamCard
              role="fundamentals"
              title="基本面分析師 (Fundamental Analyst)"
              model={quickModel}
              score={analystsStreaming.fundamentals.report?.score}
              isStreaming={analystsStreaming.fundamentals.isStreaming}
              isDone={analystsStreaming.fundamentals.isDone}
              content={analystsStreaming.fundamentals.content}
              keyPoints={analystsStreaming.fundamentals.report?.keyPoints}
              iconColor="text-blue-500"
            />
            <AgentStreamCard
              role="technical"
              title="技術面分析師 (Technical Analyst)"
              model={quickModel}
              score={analystsStreaming.technical.report?.score}
              isStreaming={analystsStreaming.technical.isStreaming}
              isDone={analystsStreaming.technical.isDone}
              content={analystsStreaming.technical.content}
              keyPoints={analystsStreaming.technical.report?.keyPoints}
              iconColor="text-emerald-500"
            />
            <AgentStreamCard
              role="news"
              title="總經新聞分析師 (News & Macro Analyst)"
              model={quickModel}
              score={analystsStreaming.news.report?.score}
              isStreaming={analystsStreaming.news.isStreaming}
              isDone={analystsStreaming.news.isDone}
              content={analystsStreaming.news.content}
              keyPoints={analystsStreaming.news.report?.keyPoints}
              iconColor="text-amber-500"
            />
            <AgentStreamCard
              role="sentiment"
              title="市場情緒分析師 (Sentiment Analyst)"
              model={quickModel}
              score={analystsStreaming.sentiment.report?.score}
              isStreaming={analystsStreaming.sentiment.isStreaming}
              isDone={analystsStreaming.sentiment.isDone}
              content={analystsStreaming.sentiment.content}
              keyPoints={analystsStreaming.sentiment.report?.keyPoints}
              iconColor="text-purple-500"
            />
          </div>
        </div>

        {/* Phase 2: Bull vs Bear Dual-Researcher Debate */}
        {(debateStatements.length > 0 || currentDebateChunk.text || currentPhase === 'debate') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                2. 多空研究員結構性對決激辯 (Bull vs Bear Debate)
              </h3>
            </div>

            <Card className="p-4 sm:p-5 border-border/80 space-y-4">
              {debateStatements.map((stmt, idx) => {
                const isBull = stmt.role === 'bull_researcher'
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border ${
                      isBull
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
                        : 'bg-rose-500/5 border-rose-500/20 text-rose-950 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 text-xs font-bold">
                      <span className={isBull ? 'text-emerald-500' : 'text-rose-500'}>
                        {stmt.speaker} · Round {stmt.round}
                      </span>
                      <span className="font-mono text-muted-foreground opacity-70">
                        {new Date(stmt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed whitespace-pre-wrap">
                      {stmt.content}
                    </div>
                  </div>
                )
              })}

              {currentDebateChunk.text && (
                <div className="p-3.5 rounded-xl border border-primary/40 bg-primary/5 text-xs animate-pulse">
                  <div className="font-bold text-primary mb-1">
                    {currentDebateChunk.speaker} 正發言中...
                  </div>
                  <div className="whitespace-pre-wrap">{currentDebateChunk.text}</div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Phase 3: Trader & Risk Management Review */}
        {(traderProposal || riskAssessment || traderText || riskText) && (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              3. 交易員進場執行計畫與風控團隊壓力測試 (Trader & Risk Management)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    資深交易員提案 (Quantitative Trader)
                  </h4>
                  {traderProposal && (
                    <Badge variant="outline" className="font-bold text-xs">
                      {traderProposal.action}
                    </Badge>
                  )}
                </div>
                <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {traderProposal?.rationale || traderText || '擬定進場點位與損益比中...'}
                </div>
                {traderProposal && (
                  <div className="pt-2 border-t text-xs grid grid-cols-2 gap-2 font-mono">
                    <div>目標價: <strong className="text-emerald-500">${traderProposal.targetPrice}</strong></div>
                    <div>停損價: <strong className="text-rose-500">${traderProposal.stopLossPrice}</strong></div>
                    <div>風報比: <strong>1:{traderProposal.riskRewardRatio}</strong></div>
                    <div>建議週期: <span className="text-muted-foreground font-sans">{traderProposal.timeHorizon.split(' ')[0]}</span></div>
                  </div>
                )}
              </Card>

              <Card className="p-4 border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-rose-500" />
                    風控團隊極限審查 (Risk Management)
                  </h4>
                  {riskAssessment && (
                    <Badge className={`text-xs ${riskAssessment.riskScore > 6 ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`} variant="secondary">
                      評分: {riskAssessment.riskScore}/10
                    </Badge>
                  )}
                </div>
                <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {riskText || (riskAssessment ? `壓力測試狀態：${riskAssessment.stressTestVerdict}。部位上限鎖定 ${riskAssessment.positionSizingCapPercent}%。` : '壓力測試評估中...')}
                </div>
                {riskAssessment && (
                  <div className="pt-2 border-t text-xs space-y-1">
                    <div className="text-muted-foreground">
                      最大下行預估: <strong className="text-rose-500">-{riskAssessment.maxDrawdownEstimatePercent}%</strong>
                    </div>
                    <div className="text-muted-foreground">
                      波動率評級: <strong>{riskAssessment.volatilityRating}</strong>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      <PortfolioModal
        open={portfolioOpen}
        onOpenChange={setPortfolioOpen}
        portfolio={portfolio}
        onSave={setPortfolio}
      />

      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  )
}
