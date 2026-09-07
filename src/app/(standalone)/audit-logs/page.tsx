'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ScrollText, Loader2, AlertCircle, Search, Store, Calendar,
  Trash2, MessageSquare, ExternalLink, RefreshCw, ClipboardCheck, ArrowLeft, Copy, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AuditLog {
  id: string
  chat_id: string | null
  store: string
  title: string
  summary: string
  upto_count: number
  created_at: string
  updated_at: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [storeFilter, setStoreFilter] = useState('')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const load = () => {
    setLoading(true)
    const url = storeFilter
      ? `/api/audit/logs?store=${encodeURIComponent(storeFilter)}`
      : '/api/audit/logs'
    fetch(url)
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(d => { setLogs(d.logs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [storeFilter])

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此則稽核日誌？')) return
    await fetch('/api/audit/logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    load()
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  const filtered = logs.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return (l.title?.toLowerCase().includes(q)) ||
      (l.store?.toLowerCase().includes(q)) ||
      (l.summary?.toLowerCase().includes(q))
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* 頂部導航 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">稽核日誌</h1>
          <p className="text-sm text-muted-foreground">由「稽核討論AI」自動摘要萃取之門市巡檢與動線討論日誌</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/audit-ai">
            <Button size="sm" variant="outline" className="gap-1.5">
              <MessageSquare className="h-4 w-4" />
              討論AI
            </Button>
          </Link>
          <Link href="/audit-inspection">
            <Button size="sm" variant="outline" className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              現場巡檢
            </Button>
          </Link>
        </div>
      </div>

      {/* 篩選列 */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Store className="h-4 w-4 text-muted-foreground" />
          <Input
            value={storeFilter}
            onChange={e => setStoreFilter(e.target.value)}
            placeholder="過濾門市代碼（如 YL）"
            className="w-40 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋關鍵字（人體工學、動線、作廢...）"
            className="h-8 text-xs flex-1"
          />
        </div>
        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 ml-auto" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          重新整理
        </Button>
      </Card>

      {/* 日誌清單 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground space-y-2">
          <ScrollText className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm font-medium">目前尚無稽核日誌</p>
          <p className="text-xs">在「稽核討論AI」中與專家溝通，系統將自動摘要並匯入此處。</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(item => (
            <Card key={item.id} className="p-4 space-y-3 relative hover:shadow-xs transition-shadow">
              <div className="flex items-start justify-between gap-2 border-b pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    {item.store && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {item.store} 門市
                      </span>
                    )}
                    <h2 className="text-base font-bold text-foreground">{item.title}</h2>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleString('zh-TW', { hour12: false })}
                    </span>
                    <span>對話訊息數：{item.upto_count} 則</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => handleCopy(item.id, `【${item.store || ''} 稽核日誌】${item.title}\n\n${item.summary}`)}
                  >
                    {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    複製
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-red-500"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* 日誌內容 */}
              <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground bg-muted/20 p-3 rounded-lg border font-mono">
                {item.summary}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
