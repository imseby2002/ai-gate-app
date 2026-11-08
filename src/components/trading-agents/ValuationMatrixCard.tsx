'use client'

import React, { useState } from 'react'
import type { ValuationSuiteResult } from '@/lib/trading-agents/valuation-models'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react'

interface ValuationMatrixCardProps {
  suite: ValuationSuiteResult
}

export function ValuationMatrixCard({ suite }: ValuationMatrixCardProps) {
  const [filter, setFilter] = useState<'All' | 'Intrinsic' | 'Relative' | 'Cost'>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredModels = suite.models.filter(m => {
    if (filter === 'All') return true
    if (filter === 'Intrinsic') return m.category.includes('Intrinsic')
    if (filter === 'Relative') return m.category.includes('Relative')
    if (filter === 'Cost') return m.category.includes('Cost of Capital')
    return true
  })

  return (
    <Card className="p-4 sm:p-5 border-border/80 shadow-sm rounded-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              十大經典估值量化模型矩陣 (10 Valuation Models Matrix)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            涵蓋現金流折現、乘數相對估值、杜邦資本效率與資本資產定價之跨維度公允定價檢驗
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Badge className="font-bold text-xs bg-primary/10 text-primary border-primary/30" variant="outline">
            平均公允價: ${suite.averageFairValue.toFixed(2)}
          </Badge>
          <Badge
            className={`font-bold text-xs ${
              suite.overallValuationVerdict.includes('Undervalued')
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : suite.overallValuationVerdict.includes('Overvalued')
                ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
            }`}
            variant="outline"
          >
            {suite.overallValuationVerdict.split(' ')[0]}
          </Badge>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {(['All', 'Intrinsic', 'Relative', 'Cost'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              filter === tab
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            }`}
          >
            {tab === 'All' && '全部 10 大模型'}
            {tab === 'Intrinsic' && '內在價值 (DCF, FCF, EVA, DDM)'}
            {tab === 'Relative' && '相對倍數 (P/E, PEG, EV/EBITDA, P/BV)'}
            {tab === 'Cost' && '資本回報 (ROE, CAPM)'}
          </button>
        ))}
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredModels.map(m => {
          const isOvervalued = m.premiumDiscountPercent > 0
          const isExpanded = expandedId === m.id

          return (
            <div
              key={m.id}
              className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {m.chineseName}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {m.name}
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    m.applicability.startsWith('High')
                      ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'
                      : m.applicability.startsWith('Moderate')
                      ? 'text-amber-500 border-amber-500/30 bg-amber-500/5'
                      : 'text-muted-foreground border-border bg-muted/40'
                  }`}
                >
                  {m.applicability.split(' ')[0]}
                </Badge>
              </div>

              {/* Price comparison row */}
              <div className="flex items-baseline justify-between bg-muted/30 p-2 rounded-lg">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">估算公允股價</span>
                  <div className="text-base font-black text-primary font-mono">
                    ${m.fairValue.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">相對現價溢折</span>
                  <div className={`text-xs font-bold font-mono ${isOvervalued ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {isOvervalued ? `溢價 +${m.premiumDiscountPercent}%` : `折價 ${Math.abs(m.premiumDiscountPercent)}%`}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {m.summary}
              </p>

              {/* Expandable parameters */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer pt-1 border-t border-border/50 w-full"
              >
                {isExpanded ? (
                  <>隱藏參數與計算公式 <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>查看底層參數與計算公式 <ChevronDown className="h-3 w-3" /></>
                )}
              </button>

              {isExpanded && (
                <div className="pt-2 text-[11px] space-y-1.5 text-muted-foreground bg-muted/20 p-2 rounded-lg">
                  <div className="font-mono text-primary break-all">
                    公式：{m.formula}
                  </div>
                  <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/50">
                    {Object.entries(m.parameters).map(([k, v]) => (
                      <div key={k} className="flex justify-between pr-2">
                        <span>{k}:</span>
                        <strong className="text-foreground">{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
