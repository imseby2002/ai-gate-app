'use client'

import React, { useState } from 'react'
import type { PortfolioContext, PositionHolding } from '@/lib/trading-agents/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Briefcase } from 'lucide-react'

interface PortfolioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolio: PortfolioContext
  onSave: (portfolio: PortfolioContext) => void
}

export function PortfolioModal({ open, onOpenChange, portfolio, onSave }: PortfolioModalProps) {
  const [cash, setCash] = useState<number>(portfolio.cash || 25000)
  const [currency, setCurrency] = useState<string>(portfolio.currency || 'USD')
  const [positions, setPositions] = useState<PositionHolding[]>(portfolio.positions || [])

  const handleAddPosition = () => {
    setPositions([...positions, { ticker: '', quantity: 10, averagePrice: 100 }])
  }

  const handleUpdatePosition = <K extends keyof PositionHolding>(idx: number, field: K, value: PositionHolding[K]) => {
    const updated = [...positions]
    updated[idx] = { ...updated[idx], [field]: value }
    setPositions(updated)
  }

  const handleRemovePosition = (idx: number) => {
    setPositions(positions.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    const validPositions = positions.filter(p => p.ticker.trim().length > 0)
    onSave({
      cash: Number(cash) || 0,
      currency,
      positions: validPositions,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            投資組合情境設定 (Portfolio Context)
          </DialogTitle>
          <DialogDescription>
            設定現有手頭可用現金與已持有部位，TradingAgents 將進行部位限制與動態風控算量。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cash & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">可用現金 (Cash)</label>
              <Input
                type="number"
                value={cash}
                onChange={e => setCash(parseFloat(e.target.value) || 0)}
                placeholder="25000"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">幣別 (Currency)</label>
              <Input
                value={currency}
                onChange={e => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                className="mt-1"
              />
            </div>
          </div>

          {/* Current Holdings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground">現有持股部位 (Positions)</label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddPosition} className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> 新增持股
              </Button>
            </div>

            {positions.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-xs">
                尚未加入現有持股部位（純現金無持股情境）
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {positions.map((pos, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg text-xs">
                    <Input
                      placeholder="代號 (如 NVDA)"
                      value={pos.ticker}
                      onChange={e => handleUpdatePosition(idx, 'ticker', e.target.value.toUpperCase())}
                      className="h-8 text-xs font-mono uppercase w-28"
                    />
                    <Input
                      type="number"
                      placeholder="股數"
                      value={pos.quantity}
                      onChange={e => handleUpdatePosition(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs w-24"
                    />
                    <Input
                      type="number"
                      placeholder="平均成本"
                      value={pos.averagePrice}
                      onChange={e => handleUpdatePosition(idx, 'averagePrice', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePosition(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            儲存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
