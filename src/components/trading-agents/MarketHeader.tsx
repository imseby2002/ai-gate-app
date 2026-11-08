'use client'

import React from 'react'
import type { MarketDataSummary } from '@/lib/trading-agents/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

interface MarketHeaderProps {
  data: MarketDataSummary
}

export function MarketHeader({ data }: MarketHeaderProps) {
  const isPositive = data.changePercent >= 0
  const prices = data.historicalPrices.map(p => p.close)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  // Generate SVG path for sparkline
  const width = 280
  const height = 50
  const points = prices.map((price, idx) => {
    const x = (idx / (prices.length - 1)) * width
    const y = height - ((price - minP) / range) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')

  return (
    <Card className="p-4 sm:p-5 bg-gradient-to-br from-card via-card to-primary/5 border border-border/80 shadow-sm rounded-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Ticker & Price */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              {data.ticker}
            </span>
            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-primary/30 text-primary">
              {data.exchange}
            </Badge>
            <span className="text-sm font-medium text-muted-foreground truncate max-w-[260px] sm:max-w-md">
              {data.companyName}
            </span>
          </div>

          <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {data.currency} {data.currentPrice.toFixed(2)}
            </span>
            <span className={`inline-flex items-center gap-1 text-sm sm:text-base font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? '+' : ''}{data.changeAmount.toFixed(2)} ({isPositive ? '+' : ''}{data.changePercent}%)
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              as of {data.asOfDate}
            </span>
          </div>
        </div>

        {/* Sparkline & Ranges */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:block">
            <div className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center justify-between">
              <span>30 日走勢</span>
              <span className="font-mono">${minP.toFixed(1)} - ${maxP.toFixed(1)}</span>
            </div>
            <svg width={width} height={height} className="overflow-visible">
              <polyline
                fill="none"
                stroke={isPositive ? '#10b981' : '#f43f5e'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div>今日最高: <span className="font-semibold text-foreground">{data.dayHigh.toFixed(2)}</span></div>
            <div>今日最低: <span className="font-semibold text-foreground">{data.dayLow.toFixed(2)}</span></div>
            <div>52週高點: <span className="font-semibold text-foreground">{data.high52w.toFixed(2)}</span></div>
            <div>52週低點: <span className="font-semibold text-foreground">{data.low52w.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {/* Technical Indicators Pill Strip */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 overflow-x-auto text-xs pb-1">
        <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1">
          <Activity className="h-3.5 w-3.5 text-primary" /> 即時指標：
        </span>
        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
          RSI(14): <strong className={`ml-1 ${data.technicals.rsi14 > 70 ? 'text-rose-500' : data.technicals.rsi14 < 30 ? 'text-emerald-500' : 'text-foreground'}`}>{data.technicals.rsi14}</strong>
        </Badge>
        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
          MACD 柱: <strong className={`ml-1 ${data.technicals.macdHistogram >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{data.technicals.macdHistogram}</strong>
        </Badge>
        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
          SMA20: <strong className="ml-1 text-foreground">{data.technicals.sma20}</strong>
        </Badge>
        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
          SMA50: <strong className="ml-1 text-foreground">{data.technicals.sma50}</strong>
        </Badge>
        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
          支撐/壓力: <strong className="ml-1 text-foreground">{data.technicals.supportLevel} / {data.technicals.resistanceLevel}</strong>
        </Badge>
        <Badge className={`ml-auto shrink-0 font-bold ${
          data.technicals.trendSignal === 'Bullish'
            ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
            : data.technicals.trendSignal === 'Bearish'
            ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
            : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
        }`} variant="outline">
          趨勢: {data.technicals.trendSignal}
        </Badge>
      </div>
    </Card>
  )
}
