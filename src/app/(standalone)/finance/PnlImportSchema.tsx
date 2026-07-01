'use client'

import { useState, useMemo } from 'react'
import { Loader2, Upload, X, Check, AlertCircle, Store, ListTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── CSV / 數字工具 ──
function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQ = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === delim) { row.push(field); field = '' }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}
function normAmount(s: string): number | null {
  const str = String(s ?? '')
  if (!str.trim()) return null
  const neg = str.includes('-') || /\(.*\)/.test(str)
  const digits = str.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return neg ? -n : n
}
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default function PnlImportSchema({ onClose, onSaved }: {
  onClose: () => void
  onSaved: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [headerRow, setHeaderRow] = useState(0)
  const [lineCol, setLineCol] = useState(0)
  const [firstDataRow, setFirstDataRow] = useState(1)
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [importValues, setImportValues] = useState(true)
  const [period, setPeriod] = useState(thisMonth())
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ lines: number; stores: number; values: number } | null>(null)

  const onFile = async (file: File) => {
    setErr(''); setResult(null)
    const text = await file.text()
    const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] || ''
    const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ','
    const all = parseCSV(text, delim)
    if (all.length < 2) { setErr('檔案沒有足夠的資料列'); return }
    setFileName(file.name)
    setRows(all)
    setHeaderRow(0); setLineCol(0); setFirstDataRow(1)
  }

  // 推導：門市欄、門市名、科目名、金額矩陣
  const derived = useMemo(() => {
    if (rows.length === 0) return { storeCols: [] as number[], storeNames: [] as string[], lineNames: [] as string[], matrix: [] as (number | null)[][] }
    const header = rows[headerRow] ?? []
    const maxCols = Math.max(...rows.map(r => r.length))
    const storeCols: number[] = []
    for (let c = 0; c < maxCols; c++) {
      if (c === lineCol) continue
      if ((header[c] ?? '').trim()) storeCols.push(c)
    }
    const storeNames = storeCols.map(c => (header[c] ?? '').trim())
    const dataRows = rows.slice(firstDataRow).filter(r => (r[lineCol] ?? '').trim())
    const lineNames = dataRows.map(r => (r[lineCol] ?? '').trim())
    const matrix = dataRows.map(r => storeCols.map(c => normAmount(r[c] ?? '')))
    return { storeCols, storeNames, lineNames, matrix }
  }, [rows, headerRow, lineCol, firstDataRow])

  const colOpts = useMemo(() => {
    const header = rows[headerRow] ?? []
    const maxCols = Math.max(0, ...rows.map(r => r.length))
    return Array.from({ length: maxCols }, (_, i) => ({ value: i, label: (header[i] ?? '').trim() || `欄位${i + 1}` }))
  }, [rows, headerRow])

  const submit = async () => {
    setSubmitting(true); setErr(''); setResult(null)
    try {
      const res = await fetch('/api/hr/pnl/import-schema', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          lineNames: derived.lineNames,
          storeNames: derived.storeNames,
          period: importValues ? period : '',
          matrix: importValues ? derived.matrix : [],
        }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error ?? '匯入失敗'); return }
      setResult({ lines: j.lines, stores: j.stores, values: j.values })
    } catch { setErr('匯入失敗') } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div>
          <h3 className="text-sm font-semibold">從報表建立門市／科目</h3>
          <p className="text-xs text-gray-400">上傳你的損益表 CSV（Excel 請「另存新檔 → CSV」）。表頭列＝門市、第一欄＝科目。</p>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}><X className="h-4 w-4" />關閉</Button>
        </div>
      </div>

      {result ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-green-700">
            <Check className="h-4 w-4" />匯入完成
          </p>
          <p className="text-green-700">科目 {result.lines} 個、門市 {result.stores} 個{result.values > 0 ? `、數字 ${result.values} 格（${period}）` : ''}</p>
          <Button size="sm" onClick={onSaved} className="mt-1">回到報表</Button>
        </div>
      ) : rows.length === 0 ? (
        <label className="flex flex-col items-center justify-center gap-2 py-12 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 text-gray-400">
          <Upload className="h-8 w-8" />
          <span className="text-sm">點此選擇 CSV 檔案</span>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{fileName}</span>
            <span className="text-gray-400">共 {rows.length} 列</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setRows([]); setFileName('') }}>重新選檔</Button>
          </div>

          {/* 對應設定 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 rounded-xl border bg-gray-50">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">表頭列（門市名所在列）</label>
              <select value={headerRow} onChange={e => setHeaderRow(Number(e.target.value))}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                {rows.map((_, i) => <option key={i} value={i}>第 {i + 1} 列</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">科目欄（科目名所在欄）</label>
              <select value={lineCol} onChange={e => setLineCol(Number(e.target.value))}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                {colOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">資料起始列</label>
              <select value={firstDataRow} onChange={e => setFirstDataRow(Number(e.target.value))}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm">
                {rows.map((_, i) => <option key={i} value={i}>第 {i + 1} 列</option>)}
              </select>
            </div>
          </div>

          {/* 預覽 */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-2"><Store className="h-3.5 w-3.5" />偵測到門市（{derived.storeNames.length}）</p>
              <div className="flex flex-wrap gap-1">
                {derived.storeNames.length === 0 ? <span className="text-xs text-gray-400">無 — 請確認表頭列</span>
                  : derived.storeNames.map((n, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">{n}</span>)}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-2"><ListTree className="h-3.5 w-3.5" />偵測到科目（{derived.lineNames.length}）</p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {derived.lineNames.length === 0 ? <span className="text-xs text-gray-400">無 — 請確認科目欄／起始列</span>
                  : derived.lineNames.map((n, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">{n}</span>)}
              </div>
            </div>
          </div>

          {/* 選項 */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border bg-gray-50 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">科目處理</span>
              <select value={mode} onChange={e => setMode(e.target.value as 'append' | 'replace')}
                className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="append">附加到現有科目</option>
                <option value="replace">取代現有科目</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={importValues} onChange={e => setImportValues(e.target.checked)} className="h-4 w-4" />
              <span className="text-gray-600">同時匯入數字到</span>
            </label>
            <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} disabled={!importValues} className="h-8 w-36 text-sm" />
          </div>

          <p className="text-[11px] text-gray-400">
            科目一律建為「明細（可錄入）」；小計／利潤線與公式請匯入後到「科目設定」自行標記。
            {mode === 'replace' && <span className="text-amber-600">　取代模式會清除現有自訂科目。</span>}
          </p>

          {err && <p className="flex items-center gap-1.5 text-sm text-red-500"><AlertCircle className="h-4 w-4" />{err}</p>}

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting || (derived.storeNames.length === 0 && derived.lineNames.length === 0)} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              建立 {derived.storeNames.length} 門市、{derived.lineNames.length} 科目
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
