'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  AlertCircle,
  X,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { MdbErrorInfo } from '@/lib/fin/zero-import'

interface MdbErrorDrawerProps {
  open: boolean
  onClose: () => void
  errors: MdbErrorInfo[]
  bookName?: string
  filename?: string
  importedAt?: string
}

export function MdbErrorDrawer({
  open,
  onClose,
  errors,
  bookName = 'FT',
  filename,
  importedAt
}: MdbErrorDrawerProps) {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const filtered = errors.filter(e => {
    if (filterSeverity === 'error' && e.severity !== 'error') return false
    if (filterSeverity === 'warning' && e.severity !== 'warning') return false
    if (search) {
      const q = search.toLowerCase()
      const matchNo = String(e.make_no).includes(q)
      const matchDate = e.date.toLowerCase().includes(q)
      const matchTitle = e.title.toLowerCase().includes(q)
      const matchDesc = e.description.toLowerCase().includes(q)
      const matchRows = e.raw_rows.some(r =>
        r.item_note.toLowerCase().includes(q) ||
        r.data_note.toLowerCase().includes(q) ||
        (r.pay_coll_name && r.pay_coll_name.toLowerCase().includes(q))
      )
      if (!matchNo && !matchDate && !matchTitle && !matchDesc && !matchRows) return false
    }
    return true
  })

  const errorCount = errors.filter(e => e.severity === 'error').length
  const warningCount = errors.filter(e => e.severity === 'warning').length

  const handleCopyReport = () => {
    const text = [
      `=== Zero.Net MDB 匯入錯誤診斷報告 ===`,
      `帳本: ${bookName} | 檔案: ${filename || 'MymoneyData.mdb'}`,
      `總錯誤數: ${errorCount} 筆 | 總警告數: ${warningCount} 筆`,
      `產生時間: ${new Date().toLocaleString('zh-TW')}`,
      `----------------------------------------`,
      ...errors.map((e, idx) => {
        return [
          `[#${idx + 1}] 流水號 MAKE_NO: ${e.make_no} | 日期: ${e.date || '無'} | 類型: ${e.severity === 'error' ? '錯誤' : '警告'} (${e.type})`,
          `  問題: ${e.title}`,
          `  說明: ${e.description}`,
          `  建議修復: ${e.suggested_fix}`,
          `  原始分錄:`,
          ...e.raw_rows.map(r => `    - 類別:${r.item_class} | 項目:${r.item_note} | 存入:${r.in_mount} | 支出:${r.out_mount} | 摘要:${r.data_note}`),
          ``
        ].join('\n')
      })
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card h-full shadow-2xl flex flex-col border-l border-border">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold">MDB 匯入異常與錯誤詳細診斷</h2>
              <Badge variant="outline" className="text-xs font-mono">帳本: {bookName}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              列出每筆異常分錄的流水號、涉及項目與詳細原因，方便您在 Zero.Net 或系統中比對修改。
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-border bg-background space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={filterSeverity === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterSeverity('all')}
                className="h-8 text-xs"
              >
                全部 ({errors.length})
              </Button>
              <Button
                size="sm"
                variant={filterSeverity === 'error' ? 'destructive' : 'outline'}
                onClick={() => setFilterSeverity('error')}
                className="h-8 text-xs gap-1"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                錯誤 ({errorCount})
              </Button>
              <Button
                size="sm"
                variant={filterSeverity === 'warning' ? 'secondary' : 'outline'}
                onClick={() => setFilterSeverity('warning')}
                className="h-8 text-xs gap-1 text-amber-600"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                警告/疑似錯字 ({warningCount})
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyReport}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已複製報告' : '複製錯誤診斷報告'}
            </Button>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋流水號 (MAKE_NO)、日期、項目名稱、備註..."
              className="pl-9 h-8 text-xs"
            />
          </div>
        </div>

        {/* Error Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Check className="h-10 w-10 mx-auto text-emerald-500 opacity-60" />
              <p className="text-sm font-medium">查無符合條件的異常或錯誤</p>
              <p className="text-xs text-muted-foreground">此檔案的分錄均可正常匯入與處理</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isExpanded = expandedId === item.id || (!expandedId && idx === 0)
              const isErr = item.severity === 'error'

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isErr
                      ? 'border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/40'
                      : 'border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isErr ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {isErr ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{item.title}</span>
                          <Badge variant="outline" className="text-2xs font-mono">
                            流水號 #{item.make_no}
                          </Badge>
                          {item.date && (
                            <Badge variant="secondary" className="text-2xs font-mono">
                              日期: {item.date}
                            </Badge>
                          )}
                          <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${
                            isErr ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isErr ? '略過未匯入' : '已匯入(建議核對)'}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1 text-muted-foreground hover:text-foreground shrink-0 rounded transition-colors"
                      title={isExpanded ? '收合原始分錄' : '查看原始分錄'}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Suggestion Fix */}
                  <div className="mt-3 pl-8 text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-medium text-foreground">💡 建議處理：</span>
                    <span>{item.suggested_fix}</span>
                  </div>

                  {/* Collapsible Raw Rows */}
                  {isExpanded && item.raw_rows && item.raw_rows.length > 0 && (
                    <div className="mt-3 pl-8 pt-2 border-t border-border/50">
                      <div className="text-2xs font-medium text-muted-foreground mb-1.5">
                        MDB 原始成對分錄資訊（共 {item.raw_rows.length} 列）：
                      </div>
                      <div className="bg-background rounded-lg border border-border/70 overflow-hidden">
                        <table className="w-full text-2xs text-left border-collapse">
                          <thead className="bg-muted/60 text-muted-foreground font-medium border-b border-border/50">
                            <tr>
                              <th className="px-2 py-1">類別</th>
                              <th className="px-2 py-1">項目名稱</th>
                              <th className="px-2 py-1 text-right">存入</th>
                              <th className="px-2 py-1 text-right">支出</th>
                              <th className="px-2 py-1">摘要備註</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {item.raw_rows.map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-muted/30">
                                <td className="px-2 py-1 font-sans">{r.item_class}</td>
                                <td className="px-2 py-1 font-sans font-medium">{r.item_note || '—'}</td>
                                <td className="px-2 py-1 text-right text-emerald-600 tabular-nums">
                                  {r.in_mount ? r.in_mount.toLocaleString('zh-TW') : '0'}
                                </td>
                                <td className="px-2 py-1 text-right text-red-600 tabular-nums">
                                  {r.out_mount ? r.out_mount.toLocaleString('zh-TW') : '0'}
                                </td>
                                <td className="px-2 py-1 truncate max-w-[200px] font-sans text-muted-foreground">
                                  {r.data_note || r.pay_coll_name || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground">
          <span>共 {filtered.length} 筆項目（錯誤: {errorCount}，警告: {warningCount}）</span>
          <Button size="sm" variant="default" onClick={onClose}>
            關閉視窗
          </Button>
        </div>
      </div>
    </div>
  )
}
