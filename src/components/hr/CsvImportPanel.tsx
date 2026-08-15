'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Download, Upload, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { parseCsv, buildCsv, downloadCsv } from '@/lib/hr/csv'

export interface CsvColumn {
  key: string
  header: string
  required?: boolean
  example?: string
  map?: (raw: string) => unknown
}

export interface ImportResult {
  inserted: number
  errors: { line: number; reason: string }[]
}

export function CsvImportPanel({
  title,
  columns,
  templateFilename,
  submit,
  onClose,
  onDone,
}: {
  title: string
  columns: CsvColumn[]
  templateFilename: string
  submit: (rows: Record<string, unknown>[]) => Promise<ImportResult>
  onClose: () => void
  onDone?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function downloadTemplate() {
    downloadCsv(templateFilename, buildCsv(columns.map(c => c.header), [columns.map(c => c.example ?? '')]))
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = '' // 允許重選同一檔案
    if (!file) return
    setErr('')
    setResult(null)
    setBusy(true)
    try {
      const grid = parseCsv(await file.text())
      if (grid.length < 2) { setErr('檔案沒有資料列（第一列須為欄位標題）'); return }

      const headerRow = grid[0].map(h => h.trim())
      const missingHeaders = columns.filter(c => c.required && !headerRow.includes(c.header)).map(c => c.header)
      if (missingHeaders.length) { setErr(`範本欄位標題不符，缺少：${missingHeaders.join('、')}`); return }

      // 整批送出，列號與 CSV 對齊；必填/格式一律由伺服器驗證回報
      const rows: Record<string, unknown>[] = []
      for (let r = 1; r < grid.length; r++) {
        const cells = grid[r]
        const obj: Record<string, unknown> = {}
        for (const col of columns) {
          const idx = headerRow.indexOf(col.header)
          const raw = idx >= 0 ? (cells[idx] ?? '').trim() : ''
          obj[col.key] = col.map ? col.map(raw) : raw
        }
        rows.push(obj)
      }

      const res = await submit(rows)
      setResult(res)
      if (res.inserted > 0) onDone?.()
    } catch (e) {
      setErr('匯入失敗：' + String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-500">
        <li>先下載範本，用 Excel 填好後「另存為 CSV（逗號分隔）」。</li>
        <li>再選擇該 CSV 檔上傳，系統會逐列匯入並回報結果。</li>
        <li>必填欄位：{columns.filter(c => c.required).map(c => c.header).join('、') || '無'}。</li>
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={downloadTemplate}>
          <Download className="h-4 w-4" />下載範本
        </Button>
        <Button size="sm" className="gap-1" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          選擇 CSV 檔上傳
        </Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      {result && (
        <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
          <p className="flex items-center gap-1.5 font-medium text-green-600">
            <CheckCircle2 className="h-4 w-4" />成功匯入 {result.inserted} 筆
          </p>
          {result.errors.length > 0 && (
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 font-medium text-amber-600">
                <AlertTriangle className="h-4 w-4" />{result.errors.length} 筆未匯入
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto pl-5 text-xs text-gray-500">
                {result.errors.map((er, i) => (
                  <li key={i}>{er.line > 0 ? `第 ${er.line} 列：` : ''}{er.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
