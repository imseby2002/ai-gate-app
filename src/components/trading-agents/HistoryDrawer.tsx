'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { History, ExternalLink, CheckCircle2 } from 'lucide-react'

export interface TradingSessionItem {
  id: string
  ticker: string
  analysis_date: string
  final_decision?: {
    action?: string
    executionOrder?: {
      targetPrice: number
      stopLossPrice: number
    }
  }
  market_data?: {
    currentPrice: number
  }
  settlement?: {
    isSettled: boolean
    settlePrice: number
    returnPct: number
    reflection: string
  }
}

interface HistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectSession?: (session: TradingSessionItem) => void
}

export function HistoryDrawer({ open, onOpenChange }: HistoryDrawerProps) {
  const [sessions, setSessions] = useState<TradingSessionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [settlePriceInput, setSettlePriceInput] = useState<Record<string, string>>({})
  const [settlingId, setSettlingId] = useState<string | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/trading-agents/history')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch (err) {
      console.warn('[HistoryDrawer] failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open])

  const handleSettle = async (sessionId: string) => {
    const price = parseFloat(settlePriceInput[sessionId] || '')
    if (isNaN(price)) return

    setSettlingId(sessionId)
    try {
      const res = await fetch('/api/trading-agents/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, settlePrice: price }),
      })
      if (res.ok) {
        await loadHistory()
      }
    } catch (err) {
      console.warn('[HistoryDrawer] settle error:', err)
    } finally {
      setSettlingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            TradingAgents 歷史決策紀錄與覆盤反思庫 (Memory Log)
          </DialogTitle>
          <DialogDescription>
            依 TradingAgents 演算法，系統會持久化過去的交易決策並支援以實際結算價進行事後覆盤 (Settlement Reflection)。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-2">
          {loading && (
            <div className="text-center py-8 text-sm text-muted-foreground animate-pulse">
              載入歷史記錄中...
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground text-sm">
              尚無歷史分析記錄。在主介面輸入股票代號即可開始首次分析！
            </div>
          )}

          {!loading && sessions.map(s => {
            const decision = s.final_decision
            const market = s.market_data
            const settlement = s.settlement

            return (
              <div key={s.id} className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-foreground">{s.ticker}</span>
                    <Badge variant="outline" className="text-xs">
                      {s.analysis_date}
                    </Badge>
                    {decision?.action && (
                      <Badge className="font-bold text-xs" variant="secondary">
                        {decision.action}
                      </Badge>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary"
                    onClick={() => window.open(`/api/trading-agents/reports/${s.id}`, '_blank')}
                  >
                    查看報告 <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {market && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                    <span>分析時價格: <strong className="text-foreground">${market.currentPrice}</strong></span>
                    {decision?.executionOrder && (
                      <>
                        <span>目標價: <strong className="text-emerald-500">${decision.executionOrder.targetPrice}</strong></span>
                        <span>停損價: <strong className="text-rose-500">${decision.executionOrder.stopLossPrice}</strong></span>
                      </>
                    )}
                  </div>
                )}

                {/* Settlement reflection block */}
                {settlement?.isSettled ? (
                  <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                    <div className="font-bold text-primary flex items-center gap-1 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      已結算 (結算價: ${settlement.settlePrice} · 實現報酬率: {settlement.returnPct > 0 ? '+' : ''}{settlement.returnPct}%)
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{settlement.reflection}</p>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="輸入實際賣出/結算價進行覆盤"
                      className="h-7 text-xs w-56"
                      value={settlePriceInput[s.id] || ''}
                      onChange={e => setSettlePriceInput({ ...settlePriceInput, [s.id]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={settlingId === s.id}
                      onClick={() => handleSettle(s.id)}
                    >
                      {settlingId === s.id ? '計算覆盤中...' : '進行結算覆盤'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
