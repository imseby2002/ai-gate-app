'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Loader2, CheckCircle2, AlertTriangle, AlertCircle, Upload, FileText, Layers } from 'lucide-react'
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
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)
  const [showErrorDrawer, setShowErrorDrawer] = useState(false)
  const [currentFilename, setCurrentFilename] = useState('')
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
      if (!user) throw new Error('請重新登入')
      const objectPath = `${user.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, file)
      if (upErr) throw new Error(`上傳失敗：${upErr.message}`)
      setPath(objectPath)

      const res = await fetch('/api/hr/cashflow/zero-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: objectPath, mode: 'preview' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '解析失敗')
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
        body: JSON.stringify({ path, mode: 'commit' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '匯入失敗')
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
              <h3 className="font-semibold text-base">匯入流水帳與科目（.mdb）</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                上傳記帳資料庫，系統將自動建置樹狀科目主檔並去重匯入交易。
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!result && !preview && (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground transition-colors">
              <Upload className="h-8 w-8 text-primary" />
              <span className="font-medium text-foreground">{busy ? '正在解析資料庫中…' : '點擊選擇 .mdb 檔案'}</span>
              <span className="text-xs text-muted-foreground">支援 MymoneyData.mdb 記帳資料庫</span>
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
                <span className="text-muted-foreground">帳本名稱：<b className="text-foreground">{preview.bookName || 'FT'}</b></span>
                <span className="text-muted-foreground">日期區間：<b className="text-foreground">{preview.dateRange ? `${preview.dateRange[0]} ~ ${preview.dateRange[1]}` : '—'}</b></span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">可匯入交易分錄</div>
                  <div className="text-lg font-bold tabular-nums">{fmt(preview.total)} 筆</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">自動建置科目</div>
                  <div className="text-lg font-bold text-primary tabular-nums">{fmt(preview.subjectsCount)} 個</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">總收入</div>
                  <div className="text-sm font-semibold text-emerald-600 tabular-nums">NT$ {fmt(preview.totalIncome)}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">總支出</div>
                  <div className="text-sm font-semibold text-red-500 tabular-nums">NT$ {fmt(preview.totalExpense)}</div>
                </div>
              </div>

              {/* 科目自動建置提示 */}
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                  <Layers className="h-4 w-4" />
                  自動建置與對齊科目樹（{preview.subjectsCount} 個科目）
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  系統將依 MDB 中的 <code>ITEM_DATA</code> 自動建立資產、負債、收入、支出樹狀科目與期初金額，並同步對應所有收付帳戶。
                </p>
              </div>

              {/* 錯誤與診斷檢視 */}
              {totalErrCount > 0 ? (
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      偵測到 {preview.errorCount} 筆格式錯誤，{preview.warningCount} 筆疑似年份筆誤
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      onClick={() => setShowErrorDrawer(true)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      檢視詳細錯誤明細
                    </Button>
                  </div>
                  <p className="text-muted-foreground">
                    點擊「檢視詳細錯誤明細」可查看具體在哪一筆流水號、日期、項目及出錯原因，方便您後續核對與修改。
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  所有分錄格式檢查完全正確，無任何格式異常。
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setPreview(null); setPath('') }}>
                  重新選擇
                </Button>
                <Button size="sm" onClick={confirmImport} disabled={busy} className="gap-1.5">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? '正在寫入資料庫…' : '確認匯入並建置科目'}
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  匯入完成！
                </div>
                <p className="text-xs leading-relaxed text-foreground">
                  已成功匯入 <b>{fmt(result.imported)}</b> 筆交易（自動去重防重複），自動建置/更新 <b>{result.subjectsCreated}</b> 個樹狀科目，新建 <b>{result.accountsCreated}</b> 個資金帳戶。
                </p>
              </div>

              {totalErrCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 text-xs">
                  <span className="text-muted-foreground">本次匯入共有 {totalErrCount} 筆異常或警告記錄</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setShowErrorDrawer(true)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    查看錯誤明細 ({totalErrCount})
                  </Button>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={onClose}>完成並進入出納系統</Button>
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
