'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, Wifi, WifiOff, Copy, Check, ExternalLink, Lock, LifeBuoy, Send,
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
const PLATFORMS: Platform[] = [
  {
    id: 'line', name: 'LINE OA', color: '#00B900', showWebhook: true,
    note: 'LINE Developers Console → Messaging API → 填入下方 Webhook URL，並開啟 Use webhook、關閉自動回應訊息。',
    docUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
    fields: [
      { key: 'line_channel_access_token', label: 'Channel Access Token', placeholder: 'U...', secret: true },
      { key: 'line_channel_secret', label: 'Channel Secret', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'whatsapp', name: 'WhatsApp Business', color: '#25D366', showWebhook: true,
    note: 'Meta Developer → WhatsApp → Configuration → 填入下方 Webhook URL 與 Verify Token。',
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    fields: [
      { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', secret: false },
      { key: 'whatsapp_access_token', label: 'Access Token', placeholder: 'EAA...', secret: true },
      { key: 'whatsapp_verify_token', label: 'Verify Token（自訂任意字串，與 Meta 後台一致）', placeholder: 'my_verify_token', secret: false },
      { key: 'whatsapp_app_secret', label: 'App Secret（Meta App 密鑰）', placeholder: '...', secret: true },
    ],
  },
  {
    id: 'telegram', name: 'Telegram', color: '#2AABEE', showWebhook: false,
    note: '向 @BotFather 建立 Bot 取得 Token；儲存後系統會自動註冊 webhook，免手動設定。',
    docUrl: 'https://core.telegram.org/bots/tutorial',
    fields: [
      { key: 'telegram_bot_token', label: 'Bot Token', placeholder: '123456789:AAF...', secret: true },
      { key: 'telegram_admin_chat_id', label: '管理員 Chat ID（選填）', placeholder: '123456789', secret: false },
    ],
  },
  {
    id: 'zalo', name: 'Zalo OA', color: '#0068FF', showWebhook: true,
    note: 'Zalo for Business → Official Account → Webhook → 填入下方 Webhook URL。',
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

  useEffect(() => { setOrigin(window.location.origin) }, [])

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
  }, [])

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
      if (!res.ok) setMsg(`${pid}：${data.error ?? '儲存失敗'}`)
      else { setMsg(`${pid} 已儲存`); load() }
    } catch { setMsg(`${pid}：網路錯誤`) }
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
      if (res.ok) { setHelpSent(true); setHelpContact(''); setHelpNote('') }
      else setHelpError(data.error ?? '送出失敗，請稍後再試')
    } catch {
      setHelpError('網路錯誤，請稍後再試')
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
          <h1 className="text-lg sm:text-xl font-bold">客服頻道綁定</h1>
          <Link href="/cs/help#channels" target="_blank" className="ml-auto text-xs text-primary font-medium hover:underline whitespace-nowrap">
            查看設定教學 →
          </Link>
        </div>

        {!isOwner && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>頻道綁定需由<strong>民宿擁有者本人</strong>操作才會生效（憑證以登入帳號儲存，協作者綁定不會套用到此民宿）。如需綁定請改用擁有者帳號登入。</span>
          </div>
        )}

        {msg && (
          <div className="mb-4 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-2">{msg}</div>
        )}

        {/* 找人幫我設定 */}
        <div className="mb-5 rounded-xl border bg-card p-4">
          {helpSent ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> 已送出，我們會盡快聯繫你協助設定。
            </div>
          ) : !helpOpen ? (
            <button onClick={() => setHelpOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <LifeBuoy className="h-4 w-4" /> 不會設定？找人幫我設定
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LifeBuoy className="h-4 w-4 text-primary" /> 找人幫我設定
              </div>
              <p className="text-xs text-muted-foreground">留下聯絡方式，我們會主動聯繫，協助你綁定頻道與設定客服內容。</p>
              <input
                value={helpContact}
                onChange={e => setHelpContact(e.target.value)}
                placeholder="聯絡方式（電話 / LINE ID，方便我們聯繫你）"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={helpNote}
                onChange={e => setHelpNote(e.target.value)}
                placeholder="想說明的需求（選填）"
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex items-center gap-2">
                <button onClick={sendHelpRequest} disabled={helpSending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {helpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  送出請求
                </button>
                <button onClick={() => setHelpOpen(false)} className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">
                  取消
                </button>
              </div>
              {helpError && <p className="text-xs text-red-500">{helpError}</p>}
            </div>
          )}
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
                      {connected ? <><Wifi className="h-3.5 w-3.5" /> 已連線</> : <><WifiOff className="h-3.5 w-3.5" /> 未綁定</>}
                    </span>
                  </div>

                  {/* 說明 */}
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {p.note}
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline">
                      官方文件 <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>

                  {/* Webhook URL */}
                  {p.showWebhook && (
                    <div className="mb-3">
                      <label className="text-[11px] font-medium text-muted-foreground">Webhook URL（貼到平台後台）</label>
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
                      const ph = f.secret && masked ? `已設定 ${masked}（留空不變更）` : f.placeholder
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
                        儲存
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
