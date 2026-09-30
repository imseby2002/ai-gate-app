'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Database, Loader2, Play, Link2, CheckCircle2, XCircle } from 'lucide-react'

interface BackupStatus {
  connected: boolean
  email: string
  last_run_at: string | null
  last_status: string
  last_file: string
  companies: { id: string; name: string; plan: string; auto: boolean; enabled: boolean }[]
}

export default function DbBackupPage() {
  return (
    <Suspense>
      <DbBackupContent />
    </Suspense>
  )
}

function DbBackupContent() {
  const params = useSearchParams()
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState(params.get('error') ? `❌ ${params.get('error')}` : params.get('connected') ? '✅ 已連結 Google Drive' : '')

  const load = useCallback(() => {
    fetch('/api/admin/db-backup').then(r => r.json()).then(setStatus)
  }, [])

  useEffect(() => { load() }, [load])

  const [callbackUri, setCallbackUri] = useState('')
  useEffect(() => { setCallbackUri(`${window.location.origin}/api/admin/db-backup/callback`) }, [])

  async function runNow() {
    setRunning(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/db-backup', { method: 'POST' })
      const d = await res.json()
      setMsg(d.ok ? `✅ 備份完成：${d.files.length} 個檔案（${d.tables} 張表、${d.rows} 筆、${d.sizeKb} KB）` : `❌ ${d.error}`)
      load()
    } finally {
      setRunning(false)
    }
  }

  async function toggleCompany(companyId: string, enabled: boolean) {
    const res = await fetch('/api/admin/db-backup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, enabled }),
    })
    if (!res.ok) setMsg(`❌ ${(await res.json().catch(() => ({})))?.error ?? '更新失敗'}`)
    load()
  }

  if (!status) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const ok = status.last_status.startsWith('成功')

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-6 w-6 text-violet-500" />
        <div>
          <h1 className="text-xl font-bold">資料庫備份</h1>
          <p className="text-sm text-muted-foreground">每天自動把全部資料（出納、人事、薪資、單位等所有資料表）備份到 Google Drive，保留 30 天。</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-6 space-y-4 shadow-sm">
        <div className="text-sm">
          Google Drive：{status.connected ? <span className="font-medium">{status.email || '已連結'}</span> : <span className="text-red-600">尚未連結</span>}
        </div>

        {status.last_run_at && (
          <div className="flex items-start gap-1.5 text-sm">
            {ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" /> : <XCircle className="h-4 w-4 mt-0.5 text-red-600" />}
            <div>
              <div>上次備份：{new Date(status.last_run_at).toLocaleString('zh-TW')}</div>
              <div className="text-muted-foreground">{status.last_status}{status.last_file ? `（${status.last_file}）` : ''}</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <a
            href="/api/admin/db-backup/connect"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border hover:bg-accent text-sm font-medium transition-colors"
          >
            <Link2 className="h-4 w-4" />
            {status.connected ? '重新連結 Google Drive' : '連結 Google Drive'}
          </a>
          <button
            onClick={runNow}
            disabled={running || !status.connected}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            立即備份
          </button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="bg-card rounded-2xl border p-6 space-y-3 shadow-sm">
        <div>
          <div className="text-sm font-bold">依公司分檔</div>
          <p className="text-xs text-muted-foreground">企業版與 MAX 方案自動備份；其他公司為付費加購，勾選後納入每日備份。</p>
        </div>
        <div className="divide-y">
          {status.companies.map(c => (
            <label key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {c.name}
                <span className="ml-2 text-xs text-muted-foreground">{c.plan}{c.auto ? '・自動備份' : ''}</span>
              </span>
              <input
                type="checkbox"
                checked={c.enabled}
                disabled={c.auto}
                onChange={e => toggleCompany(c.id, e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl p-4 text-xs text-violet-800 dark:text-violet-300 space-y-1">
        <p>備份檔存於 Google Drive「AI-GATE 資料庫備份」資料夾：每家公司一個子資料夾，另有「完整備份」供整庫還原。</p>
        <p>每天台灣時間 03:00 自動執行；超過 30 天的舊檔自動刪除。</p>
        <p>Google Cloud Console 需登記的重新導向 URI：<code className="break-all">{callbackUri}</code></p>
      </div>
    </div>
  )
}
