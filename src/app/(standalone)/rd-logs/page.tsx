'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, AlertCircle, RefreshCw, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Log { id: string; chat_id: string; title: string; summary: string; updated_at: string }

export default function RdLogsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => fetch('/api/rd/logs').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() }).then(d => { if (d) setLogs(d.logs ?? []); setLoading(false) })
  useEffect(() => { load() }, [])

  const regen = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/rd/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const d = await res.json().catch(() => ({}))
    setBusy(false); setMsg(res.ok ? `更新 ${d.updated ?? 0} 則日誌` : (d.error ?? '失敗')); load()
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
          <p className="text-sm text-gray-500">研發討論AI 對話自動摘要成日誌</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={regen} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}更新日誌</Button>
          <Link href="/rd-ai"><Button size="sm" variant="outline" className="gap-1.5"><FlaskConical className="h-4 w-4 text-indigo-600" />討論AI</Button></Link>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : logs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無日誌。與研發討論AI 對話後會自動摘要，或點「更新日誌」。</div>
        : <div className="grid gap-3">{logs.map(l => (
          <Card key={l.id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Link href="/rd-ai" className="font-medium text-sm hover:text-primary">{l.title || '（對話）'}</Link>
              <span className="text-xs text-gray-400">{new Date(l.updated_at).toLocaleString('zh-TW')}</span>
            </div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{l.summary}</div>
          </Card>))}</div>}
    </div>
  )
}
