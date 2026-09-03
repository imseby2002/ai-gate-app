'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, Monitor, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const POS_STORE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: '門市名稱', required: true, example: '信義旗艦店', aliases: ['name', '門市名稱', '門市', '分店'] },
  { key: 'slug', label: '代碼 (Slug)', example: 'xinyi', aliases: ['slug', '代碼', '門市代碼'] },
]

interface StoreRow {
  id: string
  name: string
  slug: string
  pos_terminals: { id: string; name: string; device_key: string; last_sync_at: string | null }[]
}

export default function PosStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const toggleReveal = (id: string) => setRevealed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const copyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  async function load() {
    const res = await fetch('/api/pos/stores')
    const d = await res.json()
    setStores(d.stores ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    await fetch('/api/pos/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setName('')
    load()
  }

  if (loading) return <p className="p-6 text-muted-foreground">載入中…</p>

  return (
    <div className="mx-auto max-w-2xl px-6 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Monitor className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">門市與終端</h1>
            <p className="text-sm text-muted-foreground">每間門市一台 Debian 終端。將 device_key 填入 Kiosk 或 pos-bridge。</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />批次匯入門市 (Excel/CSV)
        </Button>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入門市"
          description="支援 .xlsx, .xls 與 .csv 檔案。請填寫門市名稱與代碼（可選）。"
          columns={POS_STORE_IMPORT_COLUMNS}
          templateFilename="POS門市清單範本"
          sheetName="門市清單"
          onClose={() => setShowImport(false)}
          onSuccess={load}
          onSubmit={async rows => {
            const res = await fetch('/api/pos/stores/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      <Card className="flex gap-2 p-3">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="門市名稱" />
        <Button onClick={create} disabled={!name.trim()}>新增門市</Button>
      </Card>

      <div className="space-y-3">
        {stores.map(s => {
          const term = s.pos_terminals?.[0]
          return (
            <Card key={s.id} className="space-y-2 p-4">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">slug: {s.slug}</p>
              {term ? (
                <>
                  <p className="text-xs">終端：{term.name}</p>
                  <div className="flex items-center gap-1.5 rounded bg-muted p-2">
                    <p className="flex-1 break-all font-mono text-xs">
                      {revealed.has(term.id) ? term.device_key : `${term.device_key.slice(0, 8)}${'•'.repeat(12)}`}
                    </p>
                    <button type="button" onClick={() => toggleReveal(term.id)} className="shrink-0 text-muted-foreground hover:text-foreground" title={revealed.has(term.id) ? '隱藏金鑰' : '顯示金鑰'}>
                      {revealed.has(term.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => copyKey(term.id, term.device_key)} className="shrink-0 text-muted-foreground hover:text-foreground" title="複製金鑰">
                      {copied === term.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    上次同步：{term.last_sync_at ? new Date(term.last_sync_at).toLocaleString() : '尚未'}
                  </p>
                  <p className="text-xs">
                    Kiosk：<code className="rounded bg-muted px-1">/pos/kiosk?key={term.device_key.slice(0, 8)}…</code>
                  </p>
                </>
              ) : (
                <p className="text-xs text-amber-600">尚無終端</p>
              )}
            </Card>
          )
        })}
        {stores.length === 0 && <p className="text-sm text-muted-foreground">尚無門市</p>}
      </div>
    </div>
  )
}
