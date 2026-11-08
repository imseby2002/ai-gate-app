'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ALL_VALUATION_MODELS,
  DEFAULT_SELECTED_MODEL_IDS,
} from '@/lib/trading-agents/valuation-models'
import { Check, CheckCheck, RotateCcw, Sparkles, SlidersHorizontal, ShieldAlert, Star } from 'lucide-react'

interface ValuationModelSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onChangeSelectedIds: (ids: string[]) => void
}

export function ValuationModelSelectorModal({
  open,
  onOpenChange,
  selectedIds,
  onChangeSelectedIds,
}: ValuationModelSelectorModalProps) {
  const toggleModel = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) {
        // 至少保留一個模型
        return
      }
      onChangeSelectedIds(selectedIds.filter(x => x !== id))
    } else {
      onChangeSelectedIds([...selectedIds, id])
    }
  }

  const selectDefaults = () => {
    onChangeSelectedIds([...DEFAULT_SELECTED_MODEL_IDS])
  }

  const selectAll = () => {
    onChangeSelectedIds(ALL_VALUATION_MODELS.map(m => m.id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">估值量化模型產出配置</DialogTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs font-bold border-primary/30 text-primary bg-primary/10">
              已勾選 {selectedIds.length} / {ALL_VALUATION_MODELS.length} 款
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            自由自訂分析產出之模型。預設採用機構級 4 大核心模型，亦可隨時勾選其它相對估值與晨星星等模型。
          </DialogDescription>

          {/* Quick presets */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectDefaults}
              className="h-8 text-xs font-medium gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              套用預設精選 (4 款核心)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-8 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              全部勾選 (12 款)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectDefaults}
              className="h-8 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground ml-auto"
            >
              <RotateCcw className="h-3 w-3" />
              重置
            </Button>
          </div>
        </DialogHeader>

        {/* Models list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {ALL_VALUATION_MODELS.map(model => {
            const isChecked = selectedIds.includes(model.id)
            const isDefault = model.isDefault

            return (
              <div
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isChecked
                    ? 'border-primary/50 bg-primary/5 shadow-xs'
                    : 'border-border/60 bg-card hover:bg-muted/40 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/40 bg-transparent'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {model.chineseName}
                      </span>
                      {model.id === 'cds' && (
                        <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
                      )}
                      {model.id === 'morningstar' && (
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      )}
                      {isDefault && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/10">
                          預設核心
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {model.desc}
                    </div>
                  </div>
                </div>

                <Badge variant="secondary" className="text-[10px] shrink-0 font-medium hidden sm:inline-flex">
                  {model.category.split(' ')[0]}
                </Badge>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/30 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            預設推薦：DCF、CDS 信用利差、EV/EBITDA、ROE 杜邦分析
          </span>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-5 h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            完成設定
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
