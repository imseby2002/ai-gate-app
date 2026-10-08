'use client'

import { useTranslations, useLocale } from 'next-intl'
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
  errors: rawErrors,
  bookName = 'FT',
  filename,
  importedAt
}: MdbErrorDrawerProps) {
  const t = useTranslations('FinanceMdb')
  const locale = useLocale()
  // 伺服器回傳 msg_key/msg_params 時依語系翻譯；舊紀錄沒有就沿用中文原文
  const errors = rawErrors.map(e => {
    const k = e.msg_key
    if (!k || !t.has(`err.${k}.title`)) return e
    const p = e.msg_params ?? {}
    return { ...e, title: t(`err.${k}.title`, p), description: t(`err.${k}.desc`, p), suggested_fix: t(`err.${k}.fix`, p) }
  })
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
      t('rpTitle'),
      t('rpBook', { book: bookName, file: filename || 'MymoneyData.mdb' }),
      t('rpCounts', { e: errorCount, w: warningCount }),
      t('rpGenerated', { at: new Date().toLocaleString(locale) }),
      `----------------------------------------`,
      ...errors.map((e, idx) => {
        return [
          t('rpItem', { i: idx + 1, no: e.make_no, date: e.date || '—', sev: e.severity === 'error' ? t('sevError') : t('sevWarning'), type: e.type }),
          `  ${t('rpProblem')} ${e.title}`,
          `  ${t('rpDesc')} ${e.description}`,
          `  ${t('rpFix')} ${e.suggested_fix}`,
          `  ${t('rpRaw')}`,
          ...e.raw_rows.map(r => `    - ${t('rpRow', { cls: r.item_class, item: r.item_note, inn: r.in_mount, out: r.out_mount, note: r.data_note })}`),
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
              <h2 className="text-lg font-bold">{t('eTitle')}</h2>
              <Badge variant="outline" className="text-xs font-mono">{t('eBook', { book: bookName })}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('eDesc')}
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
                {t('fAll', { n: errors.length })}
              </Button>
              <Button
                size="sm"
                variant={filterSeverity === 'error' ? 'destructive' : 'outline'}
                onClick={() => setFilterSeverity('error')}
                className="h-8 text-xs gap-1"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {t('fError', { n: errorCount })}
              </Button>
              <Button
                size="sm"
                variant={filterSeverity === 'warning' ? 'secondary' : 'outline'}
                onClick={() => setFilterSeverity('warning')}
                className="h-8 text-xs gap-1 text-amber-600"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('fWarning', { n: warningCount })}
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyReport}
              className="h-8 text-xs gap-1.5 shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('reportCopied') : t('copyReport')}
            </Button>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('eSearchPh')}
              className="pl-9 h-8 text-xs"
            />
          </div>
        </div>

        {/* Error Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Check className="h-10 w-10 mx-auto text-emerald-500 opacity-60" />
              <p className="text-sm font-medium">{t('eNone')}</p>
              <p className="text-xs text-muted-foreground">{t('eNoneHint')}</p>
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
                            {t('voucherNo', { no: item.make_no })}
                          </Badge>
                          {item.date && (
                            <Badge variant="secondary" className="text-2xs font-mono">
                              {t('dateN', { date: item.date })}
                            </Badge>
                          )}
                          <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${
                            isErr ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isErr ? t('skipped') : t('importedCheck')}
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
                      title={isExpanded ? t('collapseRaw') : t('viewRaw')}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Suggestion Fix */}
                  <div className="mt-3 pl-8 text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="font-medium text-foreground">💡 {t('suggestion')}</span>
                    <span>{item.suggested_fix}</span>
                  </div>

                  {/* Collapsible Raw Rows */}
                  {isExpanded && item.raw_rows && item.raw_rows.length > 0 && (
                    <div className="mt-3 pl-8 pt-2 border-t border-border/50">
                      <div className="text-2xs font-medium text-muted-foreground mb-1.5">
                        {t('rawInfo', { n: item.raw_rows.length })}
                      </div>
                      <div className="bg-background rounded-lg border border-border/70 overflow-hidden">
                        <table className="w-full text-2xs text-left border-collapse">
                          <thead className="bg-muted/60 text-muted-foreground font-medium border-b border-border/50">
                            <tr>
                              <th className="px-2 py-1">{t('colClass')}</th>
                              <th className="px-2 py-1">{t('colItem')}</th>
                              <th className="px-2 py-1 text-right">{t('colIn')}</th>
                              <th className="px-2 py-1 text-right">{t('colOut')}</th>
                              <th className="px-2 py-1">{t('colNote')}</th>
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
          <span>{t('eFooter', { n: filtered.length, e: errorCount, w: warningCount })}</span>
          <Button size="sm" variant="default" onClick={onClose}>
            {t('closeWindow')}
          </Button>
        </div>
      </div>
    </div>
  )
}
