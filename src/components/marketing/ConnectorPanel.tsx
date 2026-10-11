'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Monitor, Download, KeyRound, RefreshCw, Trash2, Copy, Check, Eye } from 'lucide-react'
import { MANAGED_PACKAGES, monthlyPrice, periodPrice, type BillingCycle } from '@/lib/connector/managed-pricing'

export const CONNECTOR_DOWNLOAD_URL =
  'https://github.com/imseby2002/ai-gate-app/releases/download/connector-latest/AI-GATE-Connector.exe'

// AdsPower 推薦註冊連結（自備 AdsPower 方案）
export const ADSPOWER_SIGNUP_URL = 'https://www.adspower.net/share/TnY8c0'

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
          <div className="mt-2 text-xs">
            <span className="font-semibold">{t('ownAdspower')}</span>
            <span className="text-muted-foreground">：{t('ownAdspowerDesc')}</span>{' '}
            <a
              href={ADSPOWER_SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline font-medium"
            >
              {t('ownAdspowerLink')}
            </a>
          </div>
          <ManagedAdspower showToast={showToast} />
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

type Managed = {
  status: 'pending' | 'active' | 'suspended' | 'rejected' | 'revoked'
  login_account: string | null
  group_name: string | null
  has_password: boolean
  password: string | null
  env_quota: number
  billing_cycle: BillingCycle
  price_credits: number | null
  paid_until: string | null
  auto_renew: boolean
  next_env_quota: number | null
  next_billing_cycle: BillingCycle | null
} | null

// 客人自購 AdsPower 的每月價格（月付；年付為 6 折），用於顯示代管省多少
const SELF_MONTHLY: Record<number, number> = { 10: 9, 20: 12, 50: 21, 100: 36, 200: 61 }
const selfPrice = (envs: number, cycle: BillingCycle) =>
  Math.round(SELF_MONTHLY[envs] * (cycle === 'annual' ? 0.6 : 1) * 100) / 100

function PlanPicker({ envs, cycle, onChange }: {
  envs: number
  cycle: BillingCycle
  onChange: (envs: number, cycle: BillingCycle) => void
}) {
  const t = useTranslations('DesktopConnector')
  const sel = 'px-2 py-1 rounded-lg border border-border bg-background text-xs'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select className={sel} value={envs} onChange={e => onChange(Number(e.target.value), cycle)}>
        {MANAGED_PACKAGES.map(n => <option key={n} value={n}>{t('managedEnvs', { n })}</option>)}
      </select>
      <select className={sel} value={cycle} onChange={e => onChange(envs, e.target.value as BillingCycle)}>
        <option value="monthly">{t('managedMonthly')}</option>
        <option value="annual">{t('managedAnnual')}</option>
      </select>
      <span>
        {t('managedPrice', { price: monthlyPrice(envs, cycle), total: periodPrice(envs, cycle) })}
        <span className="text-muted-foreground">{t('managedSelfPrice', { price: selfPrice(envs, cycle) })}</span>
      </span>
    </div>
  )
}

// 方案二：AI-GATE 代管 AdsPower（選方案申請 → 管理員開通並預扣一期 → 顯示成員登入資訊；到期自動續扣）
function ManagedAdspower({ showToast }: { showToast: Toast }) {
  const t = useTranslations('DesktopConnector')
  const [managed, setManaged] = useState<Managed>(null)
  const [loaded, setLoaded] = useState(false)
  const [applying, setApplying] = useState(false)
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [envs, setEnvs] = useState(50)
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [busy, setBusy] = useState(false)

  const load = async (reveal = false) => {
    const res = await fetch(`/api/marketing/connector/managed${reveal ? '?reveal=1' : ''}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (reveal) showToast(`${t('failed')}：${data.error || res.status}`, 'error')
      return
    }
    const m: Managed = data.managed ?? null
    setManaged(m)
    if (m) {
      setEnvs(m.next_env_quota ?? m.env_quota)
      setCycle(m.next_billing_cycle ?? m.billing_cycle)
    }
    setLoaded(true)
  }

  useEffect(() => {
    void load()
  }, [])

  const send = async (method: 'POST' | 'PATCH', body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/marketing/connector/managed', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      showToast(okMsg, 'success')
      setApplying(false)
      await load()
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null
  const status = managed?.status
  const btn = 'px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50'

  return (
    <div className="mt-2 text-xs">
      <span className="font-semibold">{t('managedTitle')}</span>
      {status === 'active' && managed ? (
        <div className="mt-1 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-1">
          <div className="text-emerald-700 dark:text-emerald-300">
            {t('managedActivePlan', {
              n: managed.env_quota,
              cycle: managed.billing_cycle === 'annual' ? t('managedAnnual') : t('managedMonthly'),
              date: managed.paid_until ? new Date(managed.paid_until).toLocaleDateString() : '—',
            })}
          </div>
          <div>{t('managedAccount')}：<span className="font-mono select-all">{managed.login_account}</span></div>
          <div className="flex items-center gap-1.5">
            <span>{t('managedPassword')}：</span>
            {managed.password ? (
              <span className="font-mono select-all">{managed.password}</span>
            ) : managed.has_password ? (
              <button onClick={() => load(true)} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                <Eye className="h-3 w-3" />{t('managedReveal')}
              </button>
            ) : (
              <span className="text-muted-foreground">{t('managedNoPassword')}</span>
            )}
          </div>
          <div>{t('managedGroup')}：<span className="font-mono">{managed.group_name}</span></div>
          <div className="text-muted-foreground">
            {t('managedSteps')}{' '}
            <a href={ADSPOWER_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              {t('managedDownload')}
            </a>
          </div>
          <label className="flex items-center gap-1.5 pt-1">
            <input
              type="checkbox"
              checked={managed.auto_renew}
              disabled={busy}
              onChange={e => send('PATCH', { auto_renew: e.target.checked }, t('managedSaved'))}
            />
            <span>{t('managedAutoRenew')}</span>
          </label>
          <div className="pt-1 space-y-1">
            <div className="text-muted-foreground">{t('managedChangeHint')}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <PlanPicker envs={envs} cycle={cycle} onChange={(n, c) => { setEnvs(n); setCycle(c) }} />
              <button
                onClick={() => send('PATCH', { env_quota: envs, billing_cycle: cycle }, t('managedSaved'))}
                disabled={busy}
                className={btn}
              >
                {t('managedChange')}
              </button>
            </div>
          </div>
        </div>
      ) : status === 'suspended' ? (
        <div className="mt-1 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 space-y-1.5">
          <div className="text-orange-700 dark:text-orange-300">{t('managedSuspended')}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PlanPicker envs={envs} cycle={cycle} onChange={(n, c) => { setEnvs(n); setCycle(c) }} />
            <button
              onClick={() => send('PATCH', { action: 'reactivate', env_quota: envs, billing_cycle: cycle }, t('managedReactivated'))}
              disabled={busy}
              className={btn}
            >
              {t('managedReactivate', { total: periodPrice(envs, cycle) })}
            </button>
          </div>
        </div>
      ) : status === 'pending' ? (
        <span className="text-muted-foreground">：{t('managedPending', { total: periodPrice(managed?.env_quota ?? envs, managed?.billing_cycle ?? cycle) })}</span>
      ) : applying ? (
        <div className="mt-1 space-y-1.5">
          <PlanPicker envs={envs} cycle={cycle} onChange={(n, c) => { setEnvs(n); setCycle(c) }} />
          <div className="flex flex-col sm:flex-row gap-1.5">
            <input
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder={t('managedContact')}
              className="px-2 py-1 rounded-lg border border-border bg-background text-xs sm:w-56"
            />
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('managedNote')}
              className="px-2 py-1 rounded-lg border border-border bg-background text-xs flex-1"
            />
            <button
              onClick={() => send('POST', { contact, note, env_quota: envs, billing_cycle: cycle }, t('managedApplied'))}
              disabled={busy || !contact.trim()}
              className={btn}
            >
              {t('managedSubmit')}
            </button>
          </div>
          <div className="text-muted-foreground">{t('managedBillingNote')}</div>
        </div>
      ) : (
        <>
          <span className="text-muted-foreground">：{status === 'rejected' || status === 'revoked' ? t('managedClosed') : t('managedDesc')}</span>{' '}
          <button onClick={() => setApplying(true)} className="text-indigo-600 hover:underline font-medium">
            {t('managedApply')}
          </button>
        </>
      )}
    </div>
  )
}
