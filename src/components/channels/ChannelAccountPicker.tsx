'use client'

// 模組內「使用哪個官方帳號」選單：每個平台選一組公司官方帳號，旁邊連到官方帳號管理頁。
// 沒有公司（個人帳號）時不顯示。
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2 } from 'lucide-react'
import { CHANNEL_PLATFORM_MAP, type ChannelModuleId } from '@/lib/channels/platforms'

interface Account { id: string; platform: string; name: string; modules: string[]; is_connected: boolean }

export function ChannelAccountPicker({ module, platforms, hint }: {
  module: ChannelModuleId
  platforms: string[]
  /** 選單下方的說明（例如「以下 Zalo ID 需為選定 OA 的用戶 ID」） */
  hint?: string
}) {
  const t = useTranslations('ChannelPicker')
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [canEdit, setCanEdit] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetch(`/api/company/channels/bindings?module=${module}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive) return
        setAccounts(d?.accounts ?? null)
        setBindings(d?.bindings ?? {})
        setCanEdit(!!d?.canEdit)
      })
      .catch(() => { if (alive) setAccounts(null) })
    return () => { alive = false }
  }, [module, reloadKey])

  if (!accounts) return null

  const choose = async (platform: string, accountId: string) => {
    setSaving(platform)
    setError('')
    const res = await fetch('/api/company/channels/bindings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, platform, account_id: accountId || null }),
    }).catch(() => null)
    setSaving(null)
    if (!res?.ok) { setError(t('saveFailed')); return }
    setReloadKey(k => k + 1)
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{t('title')}</div>
        <Link href="/company/channels" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {t('manage')} <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {platforms.map(pid => {
          const list = accounts.filter(a => a.platform === pid)
          const bound = bindings[pid] ?? ''
          const auto = list.find(a => a.is_connected && a.modules.includes(module))
          return (
            <label key={pid} className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                {CHANNEL_PLATFORM_MAP[pid]?.name ?? pid}
                {saving === pid && <Loader2 className="h-3 w-3 animate-spin" />}
              </span>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-60"
                value={bound}
                disabled={!canEdit || saving === pid}
                onChange={e => choose(pid, e.target.value)}
              >
                <option value="">{auto ? t('autoWith', { name: auto.name }) : list.length ? t('auto') : t('none')}</option>
                {list.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.is_connected ? '' : ` (${t('notConnected')})`}</option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {!canEdit && <p className="text-xs text-muted-foreground">{t('readonly')}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
