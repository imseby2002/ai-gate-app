'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Monitor, Download, KeyRound, RefreshCw, Trash2, Copy, Check } from 'lucide-react'

export const CONNECTOR_DOWNLOAD_URL =
  'https://github.com/imseby2002/ai-gate-app/releases/download/connector-latest/AI-GATE-Connector.exe'

const PAIR_CODE_TTL_MINUTES = 10

type Device = { id: string; name: string; last_seen_at: string | null; created_at: string }

type Toast = (text: string, type?: 'success' | 'error' | 'info') => void

// 送出連接器任務（sync_profiles / open_profile），失敗時拋出伺服器錯誤訊息
export async function queueConnectorTask(body: Record<string, unknown>) {
  const res = await fetch('/api/marketing/connector/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export function ConnectorPanel({ showToast }: { showToast: Toast }) {
  const t = useTranslations('DesktopConnector')
  const [devices, setDevices] = useState<Device[]>([])
  const [pair, setPair] = useState<{ code: string; expires_at: string } | null>(null)
  const [busy, setBusy] = useState<'' | 'pair' | 'sync'>('')
  const [copied, setCopied] = useState(false)

  const loadDevices = async () => {
    const res = await fetch('/api/marketing/connector/devices')
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    setDevices(data.devices ?? [])
  }

  useEffect(() => {
    void loadDevices()
  }, [])

  // 顯示配對碼期間定期刷新裝置清單，配對完成後即時出現
  useEffect(() => {
    if (!pair) return
    const timer = setInterval(() => {
      if (new Date(pair.expires_at).getTime() < Date.now()) setPair(null)
      void loadDevices()
    }, 5000)
    return () => clearInterval(timer)
  }, [pair])

  const handlePair = async () => {
    setBusy('pair')
    try {
      const res = await fetch('/api/marketing/connector/pair', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPair({ code: data.code, expires_at: data.expires_at })
      setCopied(false)
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const handleSync = async () => {
    setBusy('sync')
    try {
      await queueConnectorTask({ type: 'sync_profiles' })
      showToast(t('syncQueued'), 'success')
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm(t('revokeConfirm'))) return
    const res = await fetch(`/api/marketing/connector/devices/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      showToast(`${t('failed')}：${data.error || res.status}`, 'error')
      return
    }
    showToast(t('revoked'), 'success')
    void loadDevices()
  }

  const copyCode = async () => {
    if (!pair) return
    try {
      await navigator.clipboard.writeText(pair.code)
      setCopied(true)
    } catch {
      // 剪貼簿不可用時使用者仍可手動輸入
    }
  }

  return (
    <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Monitor className="h-5 w-5 text-indigo-600" />
            <span>{t('title')}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('desc')}</p>
          <p className="text-xs text-muted-foreground mt-2">{t('steps')}</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{t('smartscreen')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={CONNECTOR_DOWNLOAD_URL}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t('download')}</span>
          </a>
          <button
            onClick={handlePair}
            disabled={busy !== ''}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{t('genCode')}</span>
          </button>
          <button
            onClick={handleSync}
            disabled={busy !== '' || devices.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} />
            <span>{t('sync')}</span>
          </button>
        </div>
      </div>

      {pair && (
        <div className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={copyCode}
            className="flex items-center gap-2 font-mono text-2xl font-bold tracking-widest text-indigo-700 dark:text-indigo-300"
          >
            <span>{pair.code}</span>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          <span className="text-xs text-muted-foreground">{t('codeHint', { min: PAIR_CODE_TTL_MINUTES })}</span>
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-semibold mb-2">{t('devices')}</div>
        {devices.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t('noDevices')}</div>
        ) : (
          <ul className="space-y-1.5">
            {devices.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-muted-foreground">
                    {d.last_seen_at ? t('lastSeen', { time: new Date(d.last_seen_at).toLocaleString() }) : t('neverSeen')}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(d.id)}
                  title={t('revoke')}
                  className="p-1 text-muted-foreground hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
