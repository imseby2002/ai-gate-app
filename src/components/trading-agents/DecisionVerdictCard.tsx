'use client'

import React, { useState } from 'react'
import type { FinalDecision, MarketDataSummary } from '@/lib/trading-agents/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Target,
  ShieldAlert,
  Percent,
  Sparkles,
  TrendingUp,
  FileText,
} from 'lucide-react'

interface DecisionVerdictCardProps {
  decision: FinalDecision
  marketData: MarketDataSummary
  sessionId?: string
  reportHtml?: string
}

export function DecisionVerdictCard({ decision, marketData, sessionId, reportHtml }: DecisionVerdictCardProps) {
  const [copied, setCopied] = useState(false)

  const actionConfig: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    'STRONG BUY': {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/40',
      glow: 'shadow-emerald-500/20',
    },
    BUY: {
      bg: 'bg-teal-500/10 dark:bg-teal-500/20',
      text: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-500/40',
      glow: 'shadow-teal-500/20',
    },
    HOLD: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/40',
      glow: 'shadow-amber-500/20',
    },
    SELL: {
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/40',
      glow: 'shadow-rose-500/20',
    },
    'STRONG SELL': {
      bg: 'bg-red-600/15 dark:bg-red-600/25',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-600/50',
      glow: 'shadow-red-600/25',
    },
  }

  const cfg = actionConfig[decision.action] || actionConfig['BUY']

  const handleCopyOrder = () => {
    const text = `【TradingAgents 執行指令單】
標的代號：${decision.executionOrder.ticker}
決策動作：${decision.executionOrder.action}
委託型態：${decision.executionOrder.orderType} (限價區間: ${marketData.currency} ${marketData.currentPrice})
目標停利價：${marketData.currency} ${decision.executionOrder.targetPrice}
嚴格停損價：${marketData.currency} ${decision.executionOrder.stopLossPrice}
部位配額：總資金 ${decision.executionOrder.suggestedAllocationPercent}%
信心指數：${decision.confidenceScore}%
持有週期：${decision.holdingPeriodGuidance}`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenReport = () => {
    if (sessionId) {
      window.open(`/api/trading-agents/reports/${sessionId}`, '_blank')
    } else if (reportHtml) {
      const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    }
  }

  return (
    <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl rounded-2xl">
      {/* Top Banner */}
      <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            TradingAgents 基金經理人最高決策白皮書
          </span>
        </div>
        <Badge variant="outline" className="text-xs font-mono font-medium border-primary/40 text-primary">
          信心度：{decision.confidenceScore}%
        </Badge>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Main Verdict Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">
              綜合裁定交易訊號 (Final Signal)
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-2xl sm:text-3xl font-black tracking-wide shadow-lg ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.glow}`}>
                ★ {decision.action}
              </span>
            </div>
          </div>

          {/* Pricing Target & Stop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Target className="h-3.5 w-3.5 text-emerald-500" /> 目標價 (TP)
              </div>
              <div className="text-lg font-black text-emerald-500 mt-0.5">
                ${decision.executionOrder.targetPrice.toFixed(2)}
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> 停損價 (SL)
              </div>
              <div className="text-lg font-black text-rose-500 mt-0.5">
                ${decision.executionOrder.stopLossPrice.toFixed(2)}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-muted/40 p-3 rounded-xl border border-border/60">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Percent className="h-3.5 w-3.5 text-primary" /> 建議部位佔比
              </div>
              <div className="text-lg font-black text-primary mt-0.5">
                {decision.executionOrder.suggestedAllocationPercent}%
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-muted/30 p-4 rounded-xl border border-border/70 text-sm leading-relaxed text-foreground/90">
          <p className="font-medium">{decision.executiveSummary}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            <strong>持有期指引：</strong> {decision.holdingPeriodGuidance}
          </div>
        </div>

        {/* Catalysts vs Risks Two-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
            <div className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-4 w-4" /> 核心上行催化劑 (Catalysts)
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {decision.keyCatalysts.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
            <div className="text-xs font-bold text-rose-500 flex items-center gap-1.5 mb-2">
              <ShieldAlert className="h-4 w-4" /> 關鍵下行風險 (Key Risks)
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {decision.keyRisks.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60 flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyOrder}
            className="text-xs font-medium"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                已複製下單委託指令！
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                複製下單指令單 (Ticket)
              </>
            )}
          </Button>

          <Button
            onClick={handleOpenReport}
            size="sm"
            className="text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            查看完整報告 (complete_report.html)
            <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
