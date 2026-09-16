'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, Save, Loader2, Wifi, WifiOff, Copy, Check, ExternalLink, Lock, LifeBuoy, Send, Sparkles, ChevronRight,
} from 'lucide-react'

type Field = { key: string; label: string; placeholder: string; secret: boolean }
type Platform = {
  id: string
  name: string
  color: string
  note: string
  docUrl: string
  showWebhook: boolean
  fields: Field[]
}

// 平台定義與憑證欄位 — 與 marketing-auto?module=cs 的綁定一致，
// 共用同一支 API（/api/social/credentials）與同一張表（social_platform_credentials）。
const getPlatforms = (t: (key: string) => string): Platform[] => [
  {
    id: 'line', name: 'LINE OA', color: '#00B900', showWebhook: true,
    note: t('platformLineNote'),
    docUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
    fields: [
      { key: 'line_channel_access_token', label: 'Channel Access Token', placeholder: 'U...', secret: true },
      { key: 'line_channel_secret', label: 'Channel Secret', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'whatsapp', name: 'WhatsApp Business', color: '#25D366', showWebhook: true,
    note: t('platformWhatsappNote'),
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    fields: [
      { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', secret: false },
      { key: 'whatsapp_access_token', label: 'Access Token', placeholder: 'EAA...', secret: true },
      { key: 'whatsapp_verify_token', label: t('fieldVerifyTokenLabel'), placeholder: 'my_verify_token', secret: false },
      { key: 'whatsapp_app_secret', label: t('fieldAppSecretLabel'), placeholder: '...', secret: true },
    ],
  },
  {
    id: 'messenger', name: 'FB Messenger', color: '#0084FF', showWebhook: true,
    note: t('platformMessengerNote'),
    docUrl: 'https://developers.facebook.com/docs/messenger-platform/getting-started',
    fields: [
      { key: 'fb_page_access_token', label: 'Page Access Token', placeholder: 'EAA...', secret: true },
      { key: 'fb_verify_token', label: t('fieldVerifyTokenLabel'), placeholder: 'my_verify_token', secret: false },
      { key: 'fb_app_secret', label: t('fieldAppSecretLabel'), placeholder: '...', secret: true },
    ],
  },
  {
    id: 'instagram', name: 'Instagram Direct', color: '#E1306C', showWebhook: true,
    note: t('platformInstagramNote'),
    docUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
    fields: [
      { key: 'ig_access_token', label: t('fieldIgAccessTokenLabel'), placeholder: 'EAA...', secret: true },
      { key: 'ig_verify_token', label: t('fieldVerifyTokenLabel'), placeholder: 'my_verify_token', secret: false },
      { key: 'ig_app_secret', label: t('fieldAppSecretLabel'), placeholder: '...', secret: true },
    ],
  },
  {
    id: 'telegram', name: 'Telegram', color: '#2AABEE', showWebhook: false,
    note: t('platformTelegramNote'),
    docUrl: 'https://core.telegram.org/bots/tutorial',
    fields: [
      { key: 'telegram_bot_token', label: 'Bot Token', placeholder: '123456789:AAF...', secret: true },
      { key: 'telegram_admin_chat_id', label: t('fieldAdminChatIdLabel'), placeholder: '123456789', secret: false },
    ],
  },
  {
    id: 'zalo', name: 'Zalo OA', color: '#0068FF', showWebhook: true,
    note: t('platformZaloNote'),
    docUrl: 'https://developers.zalo.me/docs/official-account',
    fields: [
      { key: 'zalo_oa_access_token', label: 'OA Access Token', placeholder: '...', secret: true },
    ],
  },
]

interface PlatformState {
  is_connected: boolean
  preview: Record<string, string>
  values: Record<string, string>
}

export function CsChannels({ ownerId, isOwner }: { ownerId: string; isOwner: boolean }) {
  const t = useTranslations('CsChannels')
  const PLATFORMS = useMemo(() => getPlatforms(t), [t])
  const [status, setStatus] = useState<Record<string, PlatformState>>({})
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpContact, setHelpContact] = useState('')
  const [helpNote, setHelpNote] = useState('')
  const [helpSending, setHelpSending] = useState(false)
  const [helpSent, setHelpSent] = useState(false)
  const [helpError, setHelpError] = useState<string | null>(null)
  const [helpPriceUsd, setHelpPriceUsd] = useState<number | null>(null)
  const [followupOn, setFollowupOn] = useState(false)
  const [followupSaving, setFollowupSaving] = useState(false)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    fetch('/api/marketing/cs-followup-config')
      .then(r => r.json())
      .then(d => setFollowupOn(!!d.enabled))
      .catch(() => {})
  }, [])

  const toggleFollowup = async () => {
    if (!isOwner || followupSaving) return
    const next = !followupOn
    setFollowupSaving(true)
    setFollowupOn(next)  // 樂觀更新
    try {
      const res = await fetch('/api/marketing/cs-followup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) setFollowupOn(!next)  // 失敗回復
    } catch { setFollowupOn(!next) }
    finally { setFollowupSaving(false) }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/social/credentials')
      const data = await res.json()
      const platforms = (data.platforms ?? {}) as Record<string, PlatformState>
      setStatus(platforms)
      // 預填非機密欄位的實際值
      setInputs(prev => {
        const next = { ...prev }
        for (const p of PLATFORMS) {
          next[p.id] = { ...(next[p.id] ?? {}) }
          const vals = platforms[p.id]?.values ?? {}
          for (const f of p.fields) {
            if (!f.secret && vals[f.key] != null) next[p.id][f.key] = vals[f.key]
          }
        }
        return next
      })
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [PLATFORMS])

  useEffect(() => { load() }, [load])

  const setField = (pid: string, key: string, val: string) =>
    setInputs(prev => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [key]: val } }))

  const save = async (pid: string) => {
    setSaving(pid); setMsg(null)
    try {
      const res = await fetch('/api/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: pid, credentials: inputs[pid] ?? {} }),
      })
      const data = await res.json()
      if (!res.ok) setMsg(`${pid}：${data.error ?? t('saveFailed')}`)
      else { setMsg(`${pid} ${t('saved')}`); load() }
    } catch { setMsg(`${pid}：${t('networkError')}`) }
    finally { setSaving(null); setTimeout(() => setMsg(null), 3000) }
  }

  const sendHelpRequest = async () => {
    setHelpSending(true)
    setHelpError(null)
    try {
      const res = await fetch('/api/marketing/cs-setup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: helpContact, note: helpNote }),
      })
      const data = await res.json()
      if (res.ok) {
        setHelpSent(true); setHelpContact(''); setHelpNote('')
        setHelpPriceUsd(data.isFree ? 0 : (data.priceUsd ?? null))
      } else setHelpError(data.error ?? t('requestFailed'))
    } catch {
      setHelpError(t('networkErrorRetry'))
    } finally { setHelpSending(false) }
  }

  const webhookUrl = (pid: string) => `${origin}/api/marketing/cs-webhook/${pid}/${ownerId}`
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500) } catch { /* noop */ }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-white dark:from-background dark:to-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link href="/cs" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-lg sm:text-xl font-bold">{t('pageTitle')}</h1>
          <Link href="/cs/help#channels" target="_blank" className="ml-auto text-xs text-primary font-medium hover:underline whitespace-nowrap">
            {t('setupGuideLink')}
          </Link>
        </div>

        {isOwner && (
          <Link href="/cs/plan"
            className="mb-5 flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/50 transition-colors">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{t('subscribePlan')}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t('subscribePlanDesc')}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        )}

        {!isOwner && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t.rich('ownerOnlyNotice', { b: (chunks) => <strong>{chunks}</strong> })}</span>
          </div>
        )}

        {msg && (
          <div className="mb-4 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-2">{msg}</div>
        )}

        {/* 找人幫我設定 */}
        <div className="mb-5 rounded-xl border bg-card p-4">
          {helpSent ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              {t('helpSentPrefix')}
              {helpPriceUsd != null && (helpPriceUsd > 0 ? t('helpPricePaid', { price: helpPriceUsd }) : t('helpPriceFree'))}
            </div>
          ) : !helpOpen ? (
            <button onClick={() => setHelpOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <LifeBuoy className="h-4 w-4" /> {t('helpFindSomeone')}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LifeBuoy className="h-4 w-4 text-primary" /> {t('helpFindSomeoneTitle')}
              </div>
              <p className="text-xs text-muted-foreground">{t('helpDesc')}</p>
              <p className="text-xs text-muted-foreground/80">
                {t.rich('helpScope', { b: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
              </p>
              <input
                value={helpContact}
                onChange={e => setHelpContact(e.target.value)}
                placeholder={t('contactPlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={helpNote}
                onChange={e => setHelpNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex items-center gap-2">
                <button onClick={sendHelpRequest} disabled={helpSending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {helpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('submitRequest')}
                </button>
                <button onClick={() => setHelpOpen(false)} className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">
                  {t('cancel')}
                </button>
              </div>
              {helpError && <p className="text-xs text-red-500">{helpError}</p>}
            </div>
          )}
        </div>

        {/* 自動跟進開關 */}
        <div className="mb-5 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold">{t('autoFollowupTitle')}</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t('autoFollowupDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={followupOn}
              disabled={!isOwner || followupSaving}
              onClick={toggleFollowup}
              className={`relative shrink-0 h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${followupOn ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${followupOn ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {!isOwner && <p className="text-[11px] text-amber-600 mt-2">{t('ownerOnlyToggleNote')}</p>}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {PLATFORMS.map(p => {
              const st = status[p.id]
              const connected = !!st?.is_connected
              const url = webhookUrl(p.id)
              return (
                <div key={p.id} className="bg-card rounded-2xl border p-4 sm:p-5 shadow-sm">
                  {/* 標題列 */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {connected ? <><Wifi className="h-3.5 w-3.5" /> {t('connected')}</> : <><WifiOff className="h-3.5 w-3.5" /> {t('notConnected')}</>}
                    </span>
                  </div>

                  {/* 說明 */}
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {p.note}
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline">
                      {t('officialDocs')} <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>

                  {/* Webhook URL */}
                  {p.showWebhook && (
                    <div className="mb-3">
                      <label className="text-[11px] font-medium text-muted-foreground">{t('webhookUrlLabel')}</label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 text-[11px] bg-muted rounded-lg px-2.5 py-2 break-all">{url}</code>
                        <button onClick={() => copy(url, p.id)}
                          className="shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border hover:bg-accent transition-colors">
                          {copied === p.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 憑證欄位 */}
                  <div className="space-y-3">
                    {p.fields.map(f => {
                      const masked = st?.preview?.[f.key]
                      const ph = f.secret && masked ? t('alreadySetPlaceholder', { masked }) : f.placeholder
                      return (
                        <div key={f.key}>
                          <label className="text-[11px] font-medium text-muted-foreground">{f.label}</label>
                          <input
                            type={f.secret ? 'password' : 'text'}
                            autoComplete="off"
                            disabled={!isOwner}
                            value={inputs[p.id]?.[f.key] ?? ''}
                            onChange={e => setField(p.id, f.key, e.target.value)}
                            placeholder={ph}
                            className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* 儲存 */}
                  {isOwner && (
                    <div className="mt-4">
                      <button onClick={() => save(p.id)} disabled={saving === p.id}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                        {saving === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {t('save')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
