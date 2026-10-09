'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Loader2, CheckCircle2, AlertTriangle, AlertCircle, Upload, FileText, Layers, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MdbErrorInfo } from '@/lib/fin/zero-import'
import { MdbErrorDrawer } from './MdbErrorDrawer'

interface Preview {
  bookName: string
  total: number
  skipped: number
  dateRange: [string, string] | null
  dateWarnings: number
  totalIncome: number
  totalExpense: number
  accountNames: string[]
  bookCount: number
  subjectsCount: number
  errors: MdbErrorInfo[]
  errorCount: number
  warningCount: number
}

interface CommitResult {
  imported: number
  skipped: number
  clearedPrevious?: number
  overwriteMode?: string
  accountsCreated: number
  subjectsCreated: number
  totalParsed: number
  bookName: string
  errors: MdbErrorInfo[]
  errorCount: number
  warningCount: number
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const BUCKET = 'fin-zero-import'

export function ZeroImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('FinanceMdb')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)
  const [showErrorDrawer, setShowErrorDrawer] = useState(false)
  const [currentFilename, setCurrentFilename] = useState('')
  const [overwriteMode, setOverwriteMode] = useState<'append' | 'clean_overwrite'>('append')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const supabase = useRef(createClient()).current

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setCurrentFilename(file.name)
    setErr(''); setPreview(null); setResult(null); setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t('reLogin'))
      const objectPath = `${user.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, file)
      if (upErr) throw new Error(t('uploadFailed', { msg: upErr.message }))
      setPath(objectPath)

      const res = await fetch('/api/hr/cashflow/zero-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: objectPath, mode: 'preview' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? t('parseFailed'))
      setPreview(d.preview)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (!path) return
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/hr/cashflow/zero-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, mode: 'commit', overwrite_mode: overwriteMode }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? t('importFailed'))
      setResult(d)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const activeErrors = result?.errors || preview?.errors || []
  const totalErrCount = (result?.errorCount ?? preview?.errorCount ?? 0) + (result?.warningCount ?? preview?.warningCount ?? 0)

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" onClick={onClose}>
        <Card className="w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-semibold text-base">{t('zTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('zDesc')}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!result && !preview && (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground transition-colors">
              <Upload className="h-8 w-8 text-primary" />
              <span className="font-medium text-foreground">{busy ? t('parsing') : t('chooseMdb')}</span>
              <span className="text-xs text-muted-foreground">{t('supportsMdb')}</span>
              <input ref={fileRef} type="file" accept=".mdb" className="hidden" disabled={busy} onChange={onFile} />
            </label>
          )}

          {err && (
            <div className="p-3 rounded-lg text-xs text-destructive bg-destructive/10 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          {preview && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-lg">
                <span className="text-muted-foreground">{t('bookName')}<b className="text-foreground">{preview.bookName || 'FT'}</b></span>
                <span className="text-muted-foreground">{t('dateRange')}<b className="text-foreground">{preview.dateRange ? `${preview.dateRange[0]} ~ ${preview.dateRange[1]}` : '—'}</b></span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">{t('importableRows')}</div>
                  <div className="text-lg font-bold tabular-nums">{t('rowsN', { n: fmt(preview.total) })}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">{t('autoSubjects')}</div>
                  <div className="text-lg font-bold text-primary tabular-nums">{t('itemsN', { n: fmt(preview.subjectsCount) })}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">{t('totalIncome')}</div>
                  <div className="text-sm font-semibold text-emerald-600 tabular-nums">NT$ {fmt(preview.totalIncome)}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">{t('totalExpense')}</div>
                  <div className="text-sm font-semibold text-red-500 tabular-nums">NT$ {fmt(preview.totalExpense)}</div>
                </div>
              </div>

              {/* 匯入覆蓋/去重模式選擇 */}
              <div className="rounded-xl border p-3 bg-muted/20 space-y-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {t('writeMode')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    overwriteMode === 'append' ? 'bg-primary/5 border-primary text-primary font-medium' : 'bg-card border-border hover:bg-muted/40'
                  }`}>
                    <input
                      type="radio"
                      name="overwriteMode"
                      checked={overwriteMode === 'append'}
                      onChange={() => setOverwriteMode('append')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-foreground">{t('modeAppend')}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t('modeAppendDesc')}
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    overwriteMode === 'clean_overwrite' ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 font-medium' : 'bg-card border-border hover:bg-muted/40'
                  }`}>
                    <input
                      type="radio"
                      name="overwriteMode"
                      checked={overwriteMode === 'clean_overwrite'}
                      onChange={() => setOverwriteMode('clean_overwrite')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-foreground">{t('modeClean')}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t('modeCleanDesc')}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 科目自動建置提示 */}
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                  <Layers className="h-4 w-4" />
                  {t('alignTree', { n: preview.subjectsCount })}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {t.rich('alignTreeDesc', { code: chunks => <code>{chunks}</code> })}
                </p>
              </div>

              {/* 錯誤與診斷檢視 */}
              {totalErrCount > 0 ? (
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      {t('detected', { e: preview.errorCount, w: preview.warningCount })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      onClick={() => setShowErrorDrawer(true)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {t('viewErrors')}
                    </Button>
                  </div>
                  <p className="text-muted-foreground">
                    {t('viewErrorsHint')}
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('allOk')}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setPreview(null); setPath('') }}>
                  {t('rechoose')}
                </Button>
                <Button size="sm" onClick={confirmImport} disabled={busy} className="gap-1.5 font-semibold">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? t('writing') : overwriteMode === 'clean_overwrite' ? t('confirmClean') : t('confirmAppend')}
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {t('done')}
                </div>
                <p className="text-xs leading-relaxed text-foreground">
                  {t.rich('importedN', { n: fmt(result.imported), b: chunks => <b>{chunks}</b> })}
                  {result.clearedPrevious !== undefined && result.clearedPrevious > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 font-medium">{t('clearedN', { n: fmt(result.clearedPrevious) })}</span>
                  )}
                  {result.skipped > 0 && t('skippedN', { n: fmt(result.skipped) })}
                  {t.rich('createdSummary', { s: result.subjectsCreated, a: result.accountsCreated, b: chunks => <b>{chunks}</b> })}
                </p>
              </div>

              {totalErrCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 text-xs">
                  <span className="text-muted-foreground">{t('issuesN', { n: totalErrCount })}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setShowErrorDrawer(true)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t('viewErrorsN', { n: totalErrCount })}
                  </Button>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={onClose}>{t('finish')}</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 錯誤詳細檢視 Drawer */}
      <MdbErrorDrawer
        open={showErrorDrawer}
        onClose={() => setShowErrorDrawer(false)}
        errors={activeErrors}
        bookName={preview?.bookName || result?.bookName || 'FT'}
        filename={currentFilename}
      />
    </>
  )
}
