'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, Loader2, CheckCircle2, AlertTriangle, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Preview {
  total: number
  skipped: number
  dateRange: [string, string] | null
  dateWarnings: number
  totalIncome: number
  totalExpense: number
  accountNames: string[]
  bookCount: number
}

interface CommitResult {
  imported: number
  skipped: number
  accountsCreated: number
  totalParsed: number
}

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const BUCKET = 'fin-zero-import'

export function ZeroImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const supabase = useRef(createClient()).current

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">從 Zero 匯入流水帳（.mdb）</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {!result && (
          <>
            <p className="text-xs text-muted-foreground">
              上傳 Zero（帳務小管家）的資料庫檔案（.mdb）。系統會先解析並顯示摘要，確認無誤後才會實際寫入，可重複上傳同一檔案不會造成重複匯入。
            </p>
            {!preview && (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted/50 text-sm text-muted-foreground">
                <Upload className="h-6 w-6" />
                {busy ? '處理中…' : '點擊選擇 .mdb 檔案'}
                <input ref={fileRef} type="file" accept=".mdb" className="hidden" disabled={busy} onChange={onFile} />
              </label>
            )}
          </>
        )}

        {err && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" />{err}</p>}

        {preview && !result && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">可匯入筆數</div><div className="text-lg font-bold">{fmt(preview.total)}</div></div>
              <div className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">日期範圍</div><div className="text-sm font-medium">{preview.dateRange ? `${preview.dateRange[0]} ~ ${preview.dateRange[1]}` : '—'}</div></div>
              <div className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">總收入</div><div className="text-sm font-medium text-emerald-600 tabular-nums">{fmt(preview.totalIncome)}</div></div>
              <div className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">總支出</div><div className="text-sm font-medium text-red-500 tabular-nums">{fmt(preview.totalExpense)}</div></div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>偵測到 {preview.accountNames.length} 個帳戶：{preview.accountNames.join('、')}</p>
              {preview.skipped > 0 && <p className="text-amber-600">{preview.skipped} 筆資料格式異常，將略過不匯入。</p>}
              {preview.dateWarnings > 0 && <p className="text-amber-600">{preview.dateWarnings} 筆日期年份明顯異常（可能是原始輸入錯誤），仍會照原始日期匯入，建議之後手動核對。</p>}
              {preview.bookCount > 1 && <p className="text-amber-600">偵測到 {preview.bookCount} 個帳本，將全部一併匯入。</p>}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setPreview(null); setPath('') }}>重新選擇檔案</Button>
              <Button size="sm" onClick={confirmImport} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認匯入'}</Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">匯入完成</span></div>
            <p className="text-sm">實際新增 {fmt(result.imported)} 筆（已跳過重複匯入的部分），新建立 {result.accountsCreated} 個帳戶。</p>
            <div className="flex justify-end"><Button size="sm" onClick={onClose}>關閉</Button></div>
          </div>
        )}
      </Card>
    </div>
  )
}
