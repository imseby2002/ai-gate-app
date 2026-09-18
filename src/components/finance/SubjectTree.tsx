'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Settings,
  Calendar,
  RotateCcw
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface SubjectItem {
  id: string
  class: 'asset' | 'liability' | 'income' | 'expense' | 'equity' | 'other'
  parent_name: string
  name: string
  initial_balance: number
  sort_order: number
  is_account: boolean
  style?: string
  zero_view?: boolean
}

export interface SubjectFilter {
  class?: string
  parent_name?: string
  name?: string
}

interface SubjectTreeProps {
  subjects: SubjectItem[]
  selected: SubjectFilter | null
  onSelect: (filter: SubjectFilter | null) => void
  year: number
  setYear: (y: number | ((prev: number) => number)) => void
  month: number
  setMonth: (m: number | ((prev: number) => number)) => void
  onOpenSubjectSettings?: () => void
  balances?: Record<string, number> // Map from `${class}|${parent_name}|${name}` or `${name}` to calculated balance
  accountsLoaded?: boolean // 帳戶結餘（balances）是否已載入完成；未完成前，有對應帳戶的科目不應顯示期初餘額誤導使用者
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

export function SubjectTree({
  subjects,
  selected,
  onSelect,
  year,
  setYear,
  month,
  setMonth,
  onOpenSubjectSettings,
  balances = {},
  accountsLoaded = true,
}: SubjectTreeProps) {
  // 記錄展開的節點，預設全展開
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'asset': true,
    'liability': true,
    'income': true,
    'expense': true,
    'asset|現金': true,
    'income|其它收入': true,
    'expense|飲料原料': true,
  })

  const toggleExpand = (key: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // 整理四大類與其子目錄
  const treeData = useMemo(() => {
    const classes: Record<string, { label: string; parents: Record<string, SubjectItem[]> }> = {
      asset:     { label: '資產', parents: {} },
      liability: { label: '負債', parents: {} },
      income:    { label: '收入', parents: {} },
      expense:   { label: '支出', parents: {} },
    }

    for (const sub of subjects) {
      if (sub.zero_view === false) continue
      const targetClass = classes[sub.class] || classes.asset
      const pName = sub.parent_name || sub.name || '其他'
      if (!targetClass.parents[pName]) {
        targetClass.parents[pName] = []
      }
      targetClass.parents[pName].push(sub)
    }

    return classes
  }, [subjects])

  // 計算每個父層與大類的金額加總
  const nodeTotals = useMemo(() => {
    const totals: Record<string, number> = {}

    // 先計算各底層 item
    for (const sub of subjects) {
      const itemKey = `${sub.class}|${sub.parent_name}|${sub.name}`
      const fallbackKey = sub.name
      // 有對應帳戶（is_account）的科目結餘來自 balances；在 balances 還沒載入完成前
      // 不能退回顯示 initial_balance（期初餘額），那只是還沒扣交易的誤導數字。
      const bal = balances[itemKey] ?? balances[fallbackKey] ?? (sub.is_account && !accountsLoaded ? undefined : sub.initial_balance) ?? 0
      totals[itemKey] = bal
    }

    // 計算父類 (parent) 與大類 (class)
    for (const [clsKey, clsObj] of Object.entries(treeData)) {
      let classSum = 0
      for (const [pName, items] of Object.entries(clsObj.parents)) {
        let parentSum = 0
        for (const item of items) {
          const itemKey = `${item.class}|${item.parent_name}|${item.name}`
          parentSum += totals[itemKey] || 0
        }
        totals[`${clsKey}|${pName}`] = parentSum
        classSum += parentSum
      }
      totals[clsKey] = classSum
    }

    return totals
  }, [subjects, balances, treeData, accountsLoaded])

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(y => y - 1)
      setMonth(12)
    } else {
      setMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(y => y + 1)
      setMonth(1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const handleCurrentMonth = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
  }

  return (
    <div className="flex flex-col h-full bg-card border rounded-xl overflow-hidden shadow-xs">
      {/* 頂部：年月選擇器（Zero.Net 風格） */}
      <div className="p-3 border-b bg-muted/40 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">年份</span>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value) || year)}
              className="w-16 h-7 text-xs font-mono font-semibold border rounded px-1.5 bg-background text-center"
            />
            <span className="text-xs font-bold font-mono px-1">{String(month).padStart(2, '0')}月</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-2xs text-primary"
            onClick={handleCurrentMonth}
            title="跳至本月"
          >
            設為本月
          </Button>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={handlePrevMonth}
          >
            ‹ 上個月
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={handleNextMonth}
          >
            下個月 ›
          </Button>
        </div>
      </div>

      {/* 選單標題與設定按鈕 */}
      <div className="px-3 py-2 border-b bg-muted/20 flex items-center justify-between shrink-0">
        <button
          onClick={() => onSelect(null)}
          className={`text-xs font-semibold hover:text-primary transition-colors flex items-center gap-1.5 ${
            !selected ? 'text-primary font-bold' : 'text-muted-foreground'
          }`}
        >
          <span>📁 全部科目</span>
          {!selected && <span className="text-2xs bg-primary/10 text-primary px-1.5 rounded">選取中</span>}
        </button>

        {onOpenSubjectSettings && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-2xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={onOpenSubjectSettings}
          >
            <Settings className="h-3 w-3" />
            項目設定
          </Button>
        )}
      </div>

      {/* 科目樹狀視圖（Zero.Net 雙層/三層樹） */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs select-none min-h-0">
        {(['asset', 'liability', 'income', 'expense'] as const).map(clsKey => {
          const cls = treeData[clsKey]
          const isClsOpen = expanded[clsKey] ?? true
          const clsTotal = nodeTotals[clsKey] || 0
          const isClsActive = selected?.class === clsKey && !selected?.parent_name && !selected?.name

          return (
            <div key={clsKey} className="space-y-0.5">
              {/* 大類節點（資產、負債、收入、支出） */}
              <div
                onClick={() => onSelect({ class: clsKey })}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isClsActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'hover:bg-muted text-foreground font-semibold'
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    onClick={e => toggleExpand(clsKey, e)}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    {isClsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isClsOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-80" /> : <Folder className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                  <span className="truncate">{cls.label}</span>
                </div>
                <span className="text-2xs font-mono tabular-nums opacity-90 ml-2 shrink-0">
                  {fmt(clsTotal)}
                </span>
              </div>

              {/* 大類展開後的各目錄 */}
              {isClsOpen && (
                <div className="pl-4 space-y-0.5 border-l border-border/40 ml-3">
                  {Object.entries(cls.parents).map(([pName, items]) => {
                    const parentKey = `${clsKey}|${pName}`
                    const isParentOpen = expanded[parentKey] ?? false
                    const pTotal = nodeTotals[parentKey] || 0
                    const isParentActive = selected?.class === clsKey && selected?.parent_name === pName && !selected?.name
                    const hasChildren = items.length > 1 || (items.length === 1 && items[0].name !== pName)

                    return (
                      <div key={parentKey} className="space-y-0.5">
                        {/* 中分類節點 (PARENT_NOTE，如 現金、定期存款、飲料原料) */}
                        <div
                          onClick={() => onSelect({ class: clsKey, parent_name: pName })}
                          className={`flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition-colors ${
                            isParentActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'hover:bg-muted/70 text-foreground/90'
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            {hasChildren ? (
                              <button
                                onClick={e => toggleExpand(parentKey, e)}
                                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                              >
                                {isParentOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </button>
                            ) : (
                              <span className="w-4" />
                            )}
                            <span className="truncate">{pName}</span>
                          </div>
                          <span className="text-2xs font-mono tabular-nums text-muted-foreground ml-2 shrink-0">
                            {fmt(pTotal)}
                          </span>
                        </div>

                        {/* 明細子科目節點 (ITEM_NOTE，如 保險櫃、糖、澱粉) */}
                        {isParentOpen && hasChildren && (
                          <div className="pl-4 space-y-0.5 border-l border-border/30 ml-3">
                            {items.map(it => {
                              const itemKey = `${clsKey}|${pName}|${it.name}`
                              const isItemActive = selected?.class === clsKey && selected?.parent_name === pName && selected?.name === it.name
                              const itemBal = nodeTotals[itemKey] || 0

                              return (
                                <div
                                  key={it.id}
                                  onClick={() => onSelect({ class: clsKey, parent_name: pName, name: it.name })}
                                  className={`flex items-center justify-between px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                                    isItemActive
                                      ? 'bg-blue-500 text-white font-medium shadow-2xs'
                                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />
                                    <span className="truncate">{it.name}</span>
                                  </div>
                                  <span className="text-2xs font-mono tabular-nums opacity-80 ml-2 shrink-0">
                                    {fmt(itemBal)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 底部小提示 */}
      <div className="p-2 border-t bg-muted/20 text-2xs text-muted-foreground text-center shrink-0">
        點擊科目即可快速篩選右側帳務
      </div>
    </div>
  )
}
