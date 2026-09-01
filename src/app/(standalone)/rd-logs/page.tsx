'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, AlertCircle, RefreshCw, ScrollText, FileSpreadsheet, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const RD_LOGS_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'title', label: '日誌標題', required: true, example: '配方風味測試紀錄', aliases: ['title', '標題', '主題'] },
  { key: 'summary', label: '日誌內容', required: true, example: '甜度降5%，茶香明顯提升...', aliases: ['summary', '內容', '日誌內容', '說明'] },
  { key: 'date', label: '日期', example: '2026-03-01', aliases: ['date', '日期', '更新日期'] },
]

interface Log { id: string; chat_id: string; title: string; summary: string; updated_at: string }

export default function RdLogsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')

  const load = () => fetch('/api/rd/logs').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() }).then(d => { if (d) setLogs(d.logs ?? []); setLoading(false) })
  useEffect(() => { load() }, [])

  const regen = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/rd/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const d = await res.json().catch(() => ({}))
    setBusy(false); setMsg(res.ok ? `更新 ${d.updated ?? 0} 則日誌` : (d.error ?? '失敗')); load()
  }

  const createSingle = async () => {
    if (!newTitle.trim() && !newSummary.trim()) return
    setBusy(true)
    const res = await fetch('/api/rd/logs/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ title: newTitle, summary: newSummary }] }),
    })
    setBusy(false)
    if (res.ok) {
      setShowNew(false)
      setNewTitle('')
      setNewSummary('')
      load()
    } else {
      alert('新增失敗')
    }
  }

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅研發單位可使用研發日誌</p></div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><ScrollText className="h-5 w-5 text-purple-600" /></div>
        <div>
          <h1 className="text-2xl font-bold">研發日誌</h1>
          <p className="text-sm text-gray-500">研發日誌記錄、批次匯入或與研發討論AI對話自動摘要</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />批次匯入 (Excel/CSV)
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" />新增日誌
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={regen} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}AI更新</Button>
          <Link href="/rd-ai"><Button size="sm" variant="outline" className="gap-1.5"><FlaskConical className="h-4 w-4 text-indigo-600" />討論AI</Button></Link>
        </div>
      </div>

      {showNew && (
        <Card className="p-4 space-y-3 bg-purple-50/50 border-purple-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">新增研發日誌</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <Input placeholder="日誌標題…" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <Textarea placeholder="日誌內容 / 研發細節記錄…" rows={4} value={newSummary} onChange={e => setNewSummary(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            <Button size="sm" onClick={createSingle} disabled={busy || (!newTitle.trim() && !newSummary.trim())}>儲存</Button>
          </div>
        </Card>
      )}

      {showImport && (
        <ExcelImportModal
          title="批次匯入研發日誌"
          description="支援 .xlsx, .xls 與 .csv 檔案。請包含日誌標題與內容。"
          columns={RD_LOGS_IMPORT_COLUMNS}
          templateFilename="研發日誌範本"
          sheetName="研發日誌"
          onClose={() => setShowImport(false)}
          onSuccess={load}
          onSubmit={async rows => {
            const res = await fetch('/api/rd/logs/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : logs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無日誌。可手動新增、上傳 Excel 或與研發討論AI 對話自動摘要。</div>
        : <div className="grid gap-3">{logs.map(l => (
          <Card key={l.id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm text-gray-800">{l.title || '（未命名）'}</span>
              <span className="text-xs text-gray-400">{new Date(l.updated_at).toLocaleString('zh-TW')}</span>
            </div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{l.summary}</div>
          </Card>))}</div>}
    </div>
  )
}
